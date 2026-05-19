// GitHub OAuth Device Flow implementation (Phase B v0.2).
//
// We talk to GitHub's Device Flow endpoints directly instead of pulling in
// `oauth2` or `octocrab` so we stay in control of timing/back-off semantics
// and keep the dependency surface small. The TS layer drives the polling
// loop (one `github_device_poll` invoke per `interval` seconds); this module
// just exposes a stateless "translate one HTTP round-trip into a typed
// status" surface plus keyring-backed token storage.
//
// Token storage uses the `keyring` crate which on Windows wraps the
// Credential Manager (DPAPI). We never write the access_token to disk in
// plaintext and never log it.

use serde::{Deserialize, Serialize};

// Compile-time-injected via build.rs / GITHUB_CLIENT_ID env var.
const GITHUB_CLIENT_ID: &str = env!("GITHUB_CLIENT_ID");
const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const KEYRING_SERVICE: &str = "claude-sync-ui";
const KEYRING_ACCOUNT: &str = "github-token";
// Per RFC 8628 §3.5: each `slow_down` response bumps the polling interval
// by 5 s. We cap at 30 s so a flaky network can't push us into multi-minute
// retry intervals — the device_code expires within ~15 min anyway.
const POLL_INTERVAL_MAX: u64 = 30;
const SCOPES: &str = "repo";
// User-Agent header is required by the GitHub API. Use the crate name + version.
const USER_AGENT: &str = concat!("claude-sync-ui/", env!("CARGO_PKG_VERSION"));
// REST endpoint for creating a repo for the authenticated user.
const CREATE_REPO_URL: &str = "https://api.github.com/user/repos";
// Default description if the caller doesn't supply one — keeps the repo
// discoverable on the user's GitHub profile without forcing UI copy.
const DEFAULT_REPO_DESCRIPTION: &str = "claude-sync — ~/.claude/ across machines";

/// Response handed back to the UI after `github_create_repo`.
/// We expose both `clone_url` (HTTPS) and `ssh_url` so the FE can default to
/// HTTPS for `claude-sync init` and let advanced users switch later via
/// `set_remote`. `full_name` is "owner/repo" — useful for surfacing in the UI
/// after creation.
#[derive(Serialize, Deserialize, Debug)]
pub struct RepoCreateResponse {
    pub clone_url: String,
    pub ssh_url: String,
    pub full_name: String,
}

/// Minimal projection of GitHub's repo-create response — we only care about
/// the URLs the FE needs. Extra fields in the body are ignored by serde.
#[derive(Deserialize)]
struct RepoApiResponse {
    clone_url: String,
    ssh_url: String,
    full_name: String,
}

/// Response handed back to the UI after `github_device_start`.
/// Mirrors GitHub's Device Code response but renamed / re-typed so we
/// fully control the wire format the TS layer consumes.
#[derive(Serialize, Deserialize, Debug)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// Response handed back to the UI after each `github_device_poll`.
/// `status` is one of: "pending" | "success" | "slow_down" | "expired" | "denied".
/// `new_interval` is only populated for the `"slow_down"` variant — the TS
/// caller uses it as the next setTimeout delay before re-polling.
#[derive(Serialize, Deserialize, Debug)]
pub struct DevicePollResponse {
    pub status: String,
    pub new_interval: Option<u64>,
}

/// Raw shape returned by `POST https://github.com/login/device/code`.
/// We immediately re-pack into `DeviceCodeResponse` so the public type
/// can evolve independently of the upstream API.
#[derive(Deserialize)]
struct GitHubDeviceCodeRaw {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

/// GitHub's token endpoint returns either a success body with `access_token`
/// OR an error body with `error` + `error_description`. Untagged so serde
/// picks whichever variant the field set matches.
#[derive(Deserialize)]
#[serde(untagged)]
enum GitHubTokenResponse {
    Success {
        access_token: String,
        #[allow(dead_code)]
        token_type: String,
    },
    Error {
        error: String,
        #[allow(dead_code)]
        error_description: Option<String>,
    },
}

/// Kick off the Device Flow. The caller is expected to display
/// `user_code` and open `verification_uri` in the browser, then loop
/// `poll_device_flow` every `interval` seconds.
pub async fn start_device_flow() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let resp = client
        .post(DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[("client_id", GITHUB_CLIENT_ID), ("scope", SCOPES)])
        .send()
        .await
        .map_err(|e| format!("device_code request: {}", e))?;

    // Surface HTTP-level failures (network OK but GitHub returned 4xx/5xx).
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("device_code HTTP {}: {}", status, body));
    }

    let raw: GitHubDeviceCodeRaw = resp
        .json()
        .await
        .map_err(|e| format!("device_code parse: {}", e))?;

    Ok(DeviceCodeResponse {
        device_code: raw.device_code,
        user_code: raw.user_code,
        verification_uri: raw.verification_uri,
        expires_in: raw.expires_in,
        interval: raw.interval,
    })
}

/// One iteration of the polling loop. The TS caller passes the
/// `device_code` it got from `start_device_flow` and the current polling
/// interval (so we can compute `new_interval` on `slow_down`).
pub async fn poll_device_flow(
    device_code: &str,
    current_interval: u64,
) -> Result<DevicePollResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let resp = client
        .post(ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("access_token request: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("access_token HTTP {}: {}", status, body));
    }

    let parsed: GitHubTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("access_token parse: {}", e))?;

    match parsed {
        GitHubTokenResponse::Success { access_token, .. } => {
            // Persist to the OS credential store. v0.2.0 regression: this
            // call appeared to succeed even when the keyring crate was
            // compiled without a native backend, so we add an explicit
            // round-trip check below to surface that class of bug to the FE
            // instead of letting the user land on "logged in but token gone".
            save_token(&access_token)
                .map_err(|e| format!("keyring_save_failed: {}", e))?;
            // Defense in depth: read back what we just wrote. If this fails
            // we never tell the FE the login succeeded — it stays on the
            // login screen and shows a real error string rather than the
            // misleading "먼저 GitHub에 로그인해주세요" two screens later.
            let round_trip = load_token()
                .map_err(|e| format!("keyring_round_trip_failed: {}", e))?;
            if round_trip != access_token {
                return Err("keyring_round_trip_mismatch".to_string());
            }
            Ok(DevicePollResponse {
                status: "success".to_string(),
                new_interval: None,
            })
        }
        GitHubTokenResponse::Error {
            error,
            error_description,
        } => match error.as_str() {
            "authorization_pending" => Ok(DevicePollResponse {
                status: "pending".to_string(),
                new_interval: None,
            }),
            "slow_down" => Ok(DevicePollResponse {
                status: "slow_down".to_string(),
                new_interval: Some(next_interval(current_interval)),
            }),
            "expired_token" => Ok(DevicePollResponse {
                status: "expired".to_string(),
                new_interval: None,
            }),
            "access_denied" => Ok(DevicePollResponse {
                status: "denied".to_string(),
                new_interval: None,
            }),
            other => Err(error_description.unwrap_or_else(|| other.to_string())),
        },
    }
}

// Internal helpers parameterised by service+account so tests can exercise
// the real OS credential store with a unique key (avoiding clashes with
// the user's actual login state). The public functions just bind to the
// app-wide constants.
fn save_token_at(service: &str, account: &str, token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, account)
        .map_err(|e| format!("keyring entry: {}", e))?;
    entry
        .set_password(token)
        .map_err(|e| format!("keyring set: {}", e))
}

fn load_token_at(service: &str, account: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(service, account)
        .map_err(|e| format!("keyring entry: {}", e))?;
    entry.get_password().map_err(|e| match e {
        keyring::Error::NoEntry => "not_logged_in".to_string(),
        _ => format!("keyring get: {}", e),
    })
}

fn delete_token_at(service: &str, account: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, account)
        .map_err(|e| format!("keyring entry: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // Idempotent: deleting an already-absent credential is a no-op for the UI.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {}", e)),
    }
}

pub fn save_token(token: &str) -> Result<(), String> {
    save_token_at(KEYRING_SERVICE, KEYRING_ACCOUNT, token)
}

pub fn load_token() -> Result<String, String> {
    load_token_at(KEYRING_SERVICE, KEYRING_ACCOUNT)
}

pub fn delete_token() -> Result<(), String> {
    delete_token_at(KEYRING_SERVICE, KEYRING_ACCOUNT)
}

pub fn has_token() -> bool {
    load_token().is_ok()
}

/// Cheap client-side guard before we burn an HTTP round-trip + a rate-limit
/// hit on something GitHub will reject anyway. We only enforce the bare
/// minimum (non-empty, no whitespace, no control chars) — GitHub does the
/// real validation server-side and surfaces structured errors via the 422
/// branch in `create_repo`. Pulled out as a free function so it can be
/// unit-tested without spinning up an HTTP stub.
pub(crate) fn validate_repo_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("invalid_name".to_string());
    }
    if name.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("invalid_name".to_string());
    }
    Ok(())
}

/// Create a private repo on the authenticated user's account.
///
/// Returns the URLs the FE needs to drive `claude-sync init`. Error strings
/// are kept short and stable so the TS layer can switch on them:
/// - `"not_logged_in"`     → no token in keyring (FE should route to login)
/// - `"token_expired"`     → 401 from GitHub (FE should logout + re-auth)
/// - `"forbidden"`         → 403, e.g. scope missing or secondary rate limit
/// - `"repo_taken"`        → 422 with a "name already exists" message
/// - `"github_api_error: <status>"` → anything else (network-level errors
///   surface their own descriptive `reqwest:` strings).
pub async fn create_repo(
    name: &str,
    description: Option<&str>,
) -> Result<RepoCreateResponse, String> {
    validate_repo_name(name)?;

    let token = load_token()?;

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let body = serde_json::json!({
        "name": name,
        "private": true,
        // Caller drives `claude-sync init` afterward; an auto_init=true repo
        // ships with a README that would conflict with the local working tree.
        "auto_init": false,
        "description": description.unwrap_or(DEFAULT_REPO_DESCRIPTION),
    });

    let resp = client
        .post(CREATE_REPO_URL)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        // User-Agent is also set via the builder above; keeping the builder
        // form means we don't have to pass it per-request.
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("create_repo request: {}", e))?;

    let status = resp.status();
    match status.as_u16() {
        201 => {
            let raw: RepoApiResponse = resp
                .json()
                .await
                .map_err(|e| format!("create_repo parse: {}", e))?;
            Ok(RepoCreateResponse {
                clone_url: raw.clone_url,
                ssh_url: raw.ssh_url,
                full_name: raw.full_name,
            })
        }
        401 => Err("token_expired".to_string()),
        403 => Err("forbidden".to_string()),
        422 => {
            // 422 covers a few cases (bad name, validation failure) but the
            // dominant one in this UI flow is "name already exists on this
            // account". GitHub puts that inside an `errors[].message`.
            // Anything else still maps to `repo_taken` — the FE prompt
            // ("pick a different name") is the right next step regardless.
            let body_text = resp.text().await.unwrap_or_default();
            if body_text.contains("already exists") || body_text.contains("name already exists") {
                Err("repo_taken".to_string())
            } else {
                Err(format!("github_api_error: 422 {}", body_text))
            }
        }
        _ => Err(format!("github_api_error: {}", status)),
    }
}

/// Compute the next polling interval after a `slow_down` response.
/// Pulled out as a free function so it can be unit-tested without any
/// HTTP / keyring stubs. Per RFC 8628: bump by 5 s on each `slow_down`,
/// cap at `POLL_INTERVAL_MAX` so we don't drift into multi-minute waits.
pub(crate) fn next_interval(current: u64) -> u64 {
    (current + 5).min(POLL_INTERVAL_MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_interval_increments_by_5() {
        assert_eq!(next_interval(5), 10);
        assert_eq!(next_interval(10), 15);
    }

    #[test]
    fn next_interval_caps_at_30() {
        assert_eq!(next_interval(25), 30);
        assert_eq!(next_interval(30), 30);
        assert_eq!(next_interval(100), 30);
    }

    // Empty string is the trivial reject case — guards against a UI bug
    // where the input is cleared before the user submits and we'd otherwise
    // burn a rate-limit hit on an obviously-bad request.
    #[test]
    fn validate_repo_name_rejects_empty() {
        assert_eq!(validate_repo_name("").unwrap_err(), "invalid_name");
    }

    // Whitespace and control chars can't legally appear in a GitHub repo
    // name; reject them locally so we get a fast, deterministic error
    // instead of an opaque 422 from the server.
    #[test]
    fn validate_repo_name_rejects_whitespace_and_control() {
        assert_eq!(validate_repo_name("dot claude").unwrap_err(), "invalid_name");
        assert_eq!(validate_repo_name("dot\nclaude").unwrap_err(), "invalid_name");
        assert_eq!(validate_repo_name("dot\tclaude").unwrap_err(), "invalid_name");
        assert_eq!(validate_repo_name("dot\x00claude").unwrap_err(), "invalid_name");
    }

    // Typical names users actually pick must pass — `.` and `-` are both
    // valid in GitHub repo slugs.
    #[test]
    fn validate_repo_name_accepts_typical_names() {
        assert!(validate_repo_name("dotclaude").is_ok());
        assert!(validate_repo_name("dot-claude").is_ok());
        assert!(validate_repo_name("dot.claude").is_ok());
        assert!(validate_repo_name("claude_sync_backup_2026").is_ok());
    }

    // Per-test unique service name so concurrent test runs and the user's
    // real "claude-sync-ui / github-token" entry can never collide.
    fn unique_test_service(suffix: &str) -> String {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        format!(
            "claude-sync-ui-test-{}-{}-{}",
            suffix,
            std::process::id(),
            nanos
        )
    }

    // Regression coverage for the v0.2.0 hotfix: the keyring crate was added
    // without enabling a platform backend feature, so set_password returned Ok
    // but persisted nothing. This test would have caught that — write a token,
    // read it back, and assert the same bytes survive the round-trip. If the
    // backend is a no-op the load returns "not_logged_in" and the test fails.
    #[test]
    fn save_load_round_trip_persists_token() {
        let service = unique_test_service("roundtrip");
        let account = "test-account";
        let token = "ghu_test_token_round_trip_dummy_value";

        // Clean state in case a previous failing run left an entry behind.
        let _ = delete_token_at(&service, account);

        save_token_at(&service, account, token).expect("save_token_at should succeed");
        let loaded = load_token_at(&service, account).expect("load_token_at should succeed");
        assert_eq!(loaded, token, "round-trip must preserve token bytes");

        // Always clean up so we don't pollute the user's credential store.
        delete_token_at(&service, account).expect("delete_token_at should succeed");
    }

    // After delete the credential must be absent — surfaced as the stable
    // "not_logged_in" string the FE switches on. Catches a regression where
    // delete_credential silently fails to remove the entry.
    #[test]
    fn delete_then_load_returns_not_logged_in() {
        let service = unique_test_service("delete");
        let account = "test-account";
        let token = "ghu_test_token_for_delete";

        let _ = delete_token_at(&service, account);
        save_token_at(&service, account, token).expect("save_token_at should succeed");
        delete_token_at(&service, account).expect("delete_token_at should succeed");

        match load_token_at(&service, account) {
            Err(e) => assert_eq!(e, "not_logged_in"),
            Ok(v) => panic!("expected NoEntry after delete, got token: {:?}", v),
        }

        // delete is idempotent — a second delete on an already-absent entry
        // must still return Ok so the UI's logout button is safe to spam.
        delete_token_at(&service, account).expect("idempotent delete should succeed");
    }
}
