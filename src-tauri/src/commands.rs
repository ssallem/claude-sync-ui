// Tauri commands wrapping the claude-sync sidecar.
// All commands run the sidecar via run_sidecar, then parse stdout into typed structs.

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
    if stdout.contains("Not initialized") {
        return Err("Not initialized".to_string());
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
    Ok(parse::parse_pull(&stdout))
}

#[tauri::command]
pub async fn doctor(app: AppHandle) -> Result<DoctorResult, String> {
    // Doctor returns exit 1 when overall FAIL; we still want the structured body for the UI.
    let (stdout, _stderr, _code) = run_sidecar(&app, &["doctor"]).await?;
    Ok(parse::parse_doctor(&stdout))
}

#[cfg(test)]
mod tests {
    use super::validate_remote_url;

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
}
