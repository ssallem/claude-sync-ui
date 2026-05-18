// Tauri commands wrapping the claude-sync sidecar.
// All commands run the sidecar via run_sidecar, then parse stdout into typed structs.

use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::parse;

#[derive(serde::Serialize, Clone)]
pub struct StatusResult {
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub tracked: u32,
    pub changes: Vec<ChangeEntry>,
    pub excluded_stow: u32,
    pub excluded_git: u32,
}

#[derive(serde::Serialize, Clone)]
pub struct ChangeEntry {
    pub path: String,
    pub kind: String,
}

#[derive(serde::Serialize, Clone)]
pub struct PushResult {
    pub pushed: u32,
    pub commit_sha: Option<String>,
    pub message: Option<String>,
    pub nothing_to_push: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct PullResult {
    pub kind: String,
    pub files: u32,
    pub commit_sha: Option<String>,
    pub conflict_files: u32,
}

#[derive(serde::Serialize, Clone)]
pub struct DoctorResult {
    pub overall: String,
    pub checks: Vec<DoctorCheck>,
}

#[derive(serde::Serialize, Clone)]
pub struct DoctorCheck {
    pub level: String,
    pub name: String,
    pub detail: String,
}

// Spawn the sidecar and collect full stdout/stderr/exit. Err only on spawn failure;
// callers decide how to handle non-zero exit codes (doctor wants the body either way).
async fn run_sidecar(app: &AppHandle, args: &[&str]) -> Result<(String, String, i32), String> {
    let output = app
        .shell()
        .sidecar("claude-sync")
        .map_err(|e| e.to_string())?
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let code = output.status.code().unwrap_or(-1);
    Ok((stdout, stderr, code))
}

fn fail_message(stderr: &str, stdout: &str) -> String {
    let s = stderr.trim();
    if !s.is_empty() {
        return s.to_string();
    }
    let o = stdout.trim();
    if !o.is_empty() {
        return o.to_string();
    }
    "claude-sync exited with non-zero status".to_string()
}

// claude-sync 0.x prints "Not initialized. Run `claude-sync init <remote>` first."
// on stdout with exit code 0 for read-only commands (status, doctor, pull). The
// UI needs an Err for that case so App.tsx can route to InitScreen — otherwise
// parse_status produces an empty StatusResult and the user lands on a broken
// main screen with no way out. Match leniently on the stdout prefix.
fn is_not_initialized_stdout(stdout: &str) -> bool {
    stdout.trim_start().starts_with("Not initialized")
}

// Defense in depth: the capability validator already rejects control chars and
// >2048-char strings, but we also sanity-check the URL in Rust so a future
// capability widening can't accidentally let bad input through to git.
fn validate_remote_url(remote: &str) -> Result<(), String> {
    if remote.is_empty() {
        return Err("Remote URL is empty".to_string());
    }
    if remote.len() > 2048 {
        return Err("Remote URL is too long (max 2048 chars)".to_string());
    }
    if remote.chars().any(|c| c.is_control()) {
        return Err("Remote URL contains control characters".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn init(app: AppHandle, remote: String) -> Result<String, String> {
    validate_remote_url(&remote)?;
    let (stdout, stderr, code) = run_sidecar(&app, &["init", remote.as_str()]).await?;
    if code != 0 {
        return Err(fail_message(&stderr, &stdout));
    }
    Ok(stdout.trim().to_string())
}

#[tauri::command]
pub async fn status(app: AppHandle) -> Result<StatusResult, String> {
    let (stdout, stderr, code) = run_sidecar(&app, &["status"]).await?;
    if code != 0 {
        return Err(fail_message(&stderr, &stdout));
    }
    // Sidecar prints "Not initialized..." on stdout with exit 0 — translate to Err
    // so App.tsx can route to InitScreen instead of rendering an empty StatusResult.
    if is_not_initialized_stdout(&stdout) {
        return Err(stdout.trim().to_string());
    }
    Ok(parse::parse_status(&stdout))
}

#[tauri::command]
pub async fn push(app: AppHandle, message: Option<String>) -> Result<PushResult, String> {
    let mut args: Vec<&str> = vec!["push"];
    if let Some(ref m) = message {
        if !m.is_empty() {
            args.push("-m");
            args.push(m.as_str());
        }
    }
    let (stdout, stderr, code) = run_sidecar(&app, &args).await?;
    if code != 0 {
        return Err(fail_message(&stderr, &stdout));
    }
    // "Not initialized" comes back on stdout w/ non-zero exit in the spec, but be defensive.
    if is_not_initialized_stdout(&stdout) {
        return Err(stdout.trim().to_string());
    }
    Ok(parse::parse_push(&stdout))
}

#[tauri::command]
pub async fn pull(app: AppHandle) -> Result<PullResult, String> {
    let (stdout, stderr, code) = run_sidecar(&app, &["pull"]).await?;
    // Conflict case may exit non-zero but still produces a parseable body — treat as success.
    if code != 0 && !stdout.contains("Merged with conflicts") {
        return Err(fail_message(&stderr, &stdout));
    }
    // Same "exit 0 + Not initialized on stdout" trap as status — surface to UI.
    if is_not_initialized_stdout(&stdout) {
        return Err(stdout.trim().to_string());
    }
    Ok(parse::parse_pull(&stdout))
}

#[tauri::command]
pub async fn doctor(app: AppHandle) -> Result<DoctorResult, String> {
    // Doctor returns exit 1 when overall FAIL; we still want the structured body for the UI.
    let (stdout, _stderr, _code) = run_sidecar(&app, &["doctor"]).await?;
    Ok(parse::parse_doctor(&stdout))
}

// Resolve `~/.claude/` using the same env-var precedence as the sidecar's
// `commands::util::home_dir`: HOME first, then USERPROFILE. Honors env overrides
// so tests can redirect the lookup without touching the real user profile.
fn resolve_claude_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| "could not determine home directory".to_string())?;
    Ok(home.join(".claude"))
}

// Rewrite the `url = ...` line inside `[remote "origin"]` of a git config text.
// We only mutate the first url inside the first origin section — anything else
// is left untouched so we don't accidentally clobber comments, push URLs, or
// other remotes. Returns Err if no origin section or no url line is present.
fn rewrite_origin_url(config: &str, new_url: &str) -> Result<String, String> {
    let mut out = String::new();
    let mut in_origin = false;
    let mut url_replaced = false;
    let mut found_origin = false;
    let trailing_newline = config.ends_with('\n');
    for line in config.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('[') {
            // Section header — switch context, preserve original line verbatim.
            in_origin = trimmed.trim_end() == "[remote \"origin\"]";
            if in_origin {
                found_origin = true;
            }
            out.push_str(line);
            out.push('\n');
            continue;
        }
        if in_origin && !url_replaced {
            // Match `url = ...` / `url=...` (git is case-sensitive on keys).
            let after_ws = line.trim_start();
            if let Some(rest) = after_ws.strip_prefix("url") {
                let rest = rest.trim_start();
                if rest.starts_with('=') {
                    let leading_ws: String =
                        line.chars().take_while(|c| c.is_whitespace()).collect();
                    out.push_str(&leading_ws);
                    out.push_str("url = ");
                    out.push_str(new_url);
                    out.push('\n');
                    url_replaced = true;
                    continue;
                }
            }
        }
        out.push_str(line);
        out.push('\n');
    }
    if !found_origin {
        return Err("origin remote not found in git config".to_string());
    }
    if !url_replaced {
        return Err("origin url not found in git config".to_string());
    }
    // Preserve the original file's trailing-newline state — `lines()` strips it.
    if !trailing_newline && out.ends_with('\n') {
        out.pop();
    }
    Ok(out)
}

// Atomically replace the `[remote "origin"]` URL in `~/.claude/.git/config`.
// Pure Rust (no shell out, no git2 dep) — we just read-modify-write the INI file.
// Writes via a sibling tempfile + rename so a crash mid-write can't corrupt the
// user's git config.
#[tauri::command]
pub async fn set_remote(new_url: String) -> Result<(), String> {
    validate_remote_url(&new_url)?;
    let claude_dir = resolve_claude_dir()?;
    let config_path = claude_dir.join(".git").join("config");
    if !config_path.exists() {
        return Err(
            "Not initialized. Run `claude-sync init <remote>` first.".to_string(),
        );
    }
    let original = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("read {}: {e}", config_path.display()))?;
    let updated = rewrite_origin_url(&original, &new_url)?;
    if updated == original {
        // No-op: nothing to write, no risk to take.
        return Ok(());
    }
    // Per-call unique tempfile name so two concurrent set_remote invocations
    // (rare, but possible if the user double-clicks the Update button while
    // the modal hasn't disabled yet) don't trample each other's write. PID +
    // nanos is enough entropy for the realistic concurrency we expect here
    // without pulling in the `tempfile` crate.
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let tmp_name = format!("config.tmp.{}.{}", std::process::id(), nanos);
    let tmp_path = config_path.with_file_name(tmp_name);
    std::fs::write(&tmp_path, &updated)
        .map_err(|e| format!("write {}: {e}", tmp_path.display()))?;
    std::fs::rename(&tmp_path, &config_path).map_err(|e| {
        // Best-effort cleanup so we don't leave a stray config.tmp.* behind.
        let _ = std::fs::remove_file(&tmp_path);
        format!("replace {}: {e}", config_path.display())
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        fail_message, is_not_initialized_stdout, rewrite_origin_url, validate_remote_url,
    };

    #[test]
    fn rejects_empty_url() {
        assert!(validate_remote_url("").is_err());
    }

    #[test]
    fn rejects_control_chars() {
        assert!(validate_remote_url("git@github.com:me/dot\nclaude.git").is_err());
        assert!(validate_remote_url("git@github.com:me/dot\x00claude.git").is_err());
        assert!(validate_remote_url("git@github.com:me/dot\x1bclaude.git").is_err());
    }

    #[test]
    fn rejects_oversized_url() {
        let url = "a".repeat(2049);
        assert!(validate_remote_url(&url).is_err());
    }

    #[test]
    fn accepts_typical_urls() {
        assert!(validate_remote_url("git@github.com:me/dotclaude.git").is_ok());
        assert!(validate_remote_url("https://github.com/me/dotclaude.git").is_ok());
        assert!(validate_remote_url("ssh://git@example.com/repo.git").is_ok());
    }

    #[test]
    fn accepts_max_length_url() {
        let url = "a".repeat(2048);
        assert!(validate_remote_url(&url).is_ok());
    }

    // Regression: claude-sync 0.x prints "Not initialized..." on stdout with
    // exit code 0 for read-only commands. The helper must flag that string so
    // status() returns Err and the UI shows InitScreen.
    #[test]
    fn detects_not_initialized_stdout() {
        assert!(is_not_initialized_stdout(
            "Not initialized. Run `claude-sync init <remote>` first.\n"
        ));
        // Tolerate leading whitespace — the sidecar might add a newline first.
        assert!(is_not_initialized_stdout(
            "\n  Not initialized. Run `claude-sync init <remote>` first."
        ));
    }

    #[test]
    fn ignores_unrelated_stdout() {
        assert!(!is_not_initialized_stdout(""));
        assert!(!is_not_initialized_stdout(
            "Branch: main (ahead 0, behind 0)\nNothing changed\n"
        ));
        assert!(!is_not_initialized_stdout(
            "Pushed 3 file(s) -> origin/main\n"
        ));
        // "not initialized" lowercase elsewhere in the line must not trigger it.
        assert!(!is_not_initialized_stdout(
            "Branch: main\n  some submodule is not initialized yet\n"
        ));
    }

    #[test]
    fn fail_message_prefers_stderr_then_stdout_then_default() {
        assert_eq!(fail_message("boom", "ignored"), "boom");
        assert_eq!(fail_message("", "stdout body"), "stdout body");
        assert_eq!(
            fail_message("", ""),
            "claude-sync exited with non-zero status"
        );
    }

    // Typical config produced by `git2::Repository::remote("origin", ...)` —
    // tab indented, `url = ...` on its own line. Make sure the rewrite hits
    // only that line and leaves everything else alone.
    #[test]
    fn rewrite_replaces_origin_url() {
        let input = "[core]\n\trepositoryformatversion = 0\n[remote \"origin\"]\n\turl = git@old.example.com:me/dot.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n";
        let out = rewrite_origin_url(input, "git@new.example.com:me/dot.git").unwrap();
        assert!(out.contains("url = git@new.example.com:me/dot.git"));
        assert!(!out.contains("git@old.example.com"));
        // The fetch line and other sections must survive unchanged.
        assert!(out.contains("fetch = +refs/heads/*:refs/remotes/origin/*"));
        assert!(out.contains("[core]"));
        assert!(out.contains("repositoryformatversion = 0"));
    }

    // Other remotes (e.g. an `upstream` mirror) and any non-url keys in the
    // origin section must be preserved untouched.
    #[test]
    fn rewrite_only_touches_origin_section() {
        let input = "[remote \"origin\"]\n\turl = https://old/a.git\n[remote \"upstream\"]\n\turl = https://other/b.git\n";
        let out = rewrite_origin_url(input, "https://new/a.git").unwrap();
        assert!(out.contains("url = https://new/a.git"));
        assert!(out.contains("url = https://other/b.git"));
    }

    #[test]
    fn rewrite_fails_without_origin_section() {
        let input = "[core]\n\trepositoryformatversion = 0\n";
        assert!(rewrite_origin_url(input, "git@new/repo.git").is_err());
    }

    #[test]
    fn rewrite_fails_with_origin_but_no_url() {
        let input = "[remote \"origin\"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n";
        assert!(rewrite_origin_url(input, "git@new/repo.git").is_err());
    }

    #[test]
    fn rewrite_preserves_trailing_newline_state() {
        let with_nl = "[remote \"origin\"]\n\turl = a\n";
        let no_nl = "[remote \"origin\"]\n\turl = a";
        assert!(rewrite_origin_url(with_nl, "b").unwrap().ends_with('\n'));
        assert!(!rewrite_origin_url(no_nl, "b").unwrap().ends_with('\n'));
    }
}
