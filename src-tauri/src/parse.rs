// Stdout parsers for claude-sync CLI output.
// Hand-written rather than regex-based to avoid adding the regex crate.

use crate::commands::{
    ChangeEntry, DoctorCheck, DoctorResult, PullResult, PushResult, StatusResult,
};

pub fn parse_status(stdout: &str) -> StatusResult {
    let mut branch = String::new();
    let mut ahead: u32 = 0;
    let mut behind: u32 = 0;
    let mut tracked: u32 = 0;
    let mut excluded_stow: u32 = 0;
    let mut excluded_git: u32 = 0;
    let mut changes: Vec<ChangeEntry> = Vec::new();

    let mut in_changes = false;
    let nothing_changed = stdout.contains("Nothing changed");

    for raw in stdout.lines() {
        let line = raw.trim_end();
        if line.starts_with("Branch:") {
            in_changes = false;
            parse_branch_line(line, &mut branch, &mut ahead, &mut behind);
        } else if line.starts_with("Changes:") {
            in_changes = true;
        } else if line.starts_with("Tracking ") {
            in_changes = false;
            parse_tracking_line(line, &mut tracked, &mut excluded_stow, &mut excluded_git);
        } else if in_changes && !nothing_changed {
            if let Some(entry) = parse_change_entry(raw) {
                changes.push(entry);
            }
        }
    }

    StatusResult {
        branch,
        ahead,
        behind,
        tracked,
        changes,
        excluded_stow,
        excluded_git,
    }
}

fn parse_branch_line(line: &str, branch: &mut String, ahead: &mut u32, behind: &mut u32) {
    // "Branch: main (ahead 2, behind 0)"
    let after = line.trim_start_matches("Branch:").trim();
    if let Some((name, paren)) = after.split_once(" (") {
        *branch = name.trim().to_string();
        let inside = paren.trim_end_matches(')');
        for part in inside.split(',') {
            let part = part.trim();
            if let Some(rest) = part.strip_prefix("ahead ") {
                *ahead = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = part.strip_prefix("behind ") {
                *behind = rest.trim().parse().unwrap_or(0);
            }
        }
    } else {
        *branch = after.to_string();
    }
}

fn parse_tracking_line(line: &str, tracked: &mut u32, stow: &mut u32, git: &mut u32) {
    // "Tracking 14 file(s) (excluded: 3 by .stowignore / 0 by .gitignore)"
    let rest = line.trim_start_matches("Tracking ").trim_start();
    if let Some((count_str, _)) = rest.split_once(" file(s)") {
        *tracked = count_str.trim().parse().unwrap_or(0);
    }
    if let Some(start) = line.find("(excluded: ") {
        let tail = &line[start + "(excluded: ".len()..];
        if let Some((s, after)) = tail.split_once(" by .stowignore") {
            *stow = s.trim().parse().unwrap_or(0);
            if let Some((_, after2)) = after.split_once("/ ") {
                if let Some((g, _)) = after2.split_once(" by .gitignore") {
                    *git = g.trim().parse().unwrap_or(0);
                }
            }
        }
    }
}

fn parse_change_entry(raw: &str) -> Option<ChangeEntry> {
    // "  M  settings.json"  or  "  ?? new.md"
    let line = raw.trim_start();
    if line.is_empty() {
        return None;
    }
    let mut parts = line.splitn(2, char::is_whitespace);
    let kind = parts.next()?.trim();
    let path = parts.next()?.trim();
    if kind.is_empty() || path.is_empty() {
        return None;
    }
    // libgit2's status with recurse_untracked_dirs=false emits untracked
    // directories as "daemon/" (trailing slash). These are not files, so we
    // skip them — if we let them through, FileTree.groupByDir downstream
    // produces a child with an empty `name` and the UI renders a blank row.
    if path.ends_with('/') || path.ends_with('\\') {
        return None;
    }
    // Accept any 1-2 char status marker; normalise to first char for the typed enum-ish field.
    Some(ChangeEntry {
        path: path.to_string(),
        kind: kind.to_string(),
    })
}

pub fn parse_push(stdout: &str) -> PushResult {
    if stdout.contains("Nothing to push") {
        return PushResult {
            pushed: 0,
            commit_sha: None,
            message: None,
            nothing_to_push: true,
        };
    }

    let mut pushed: u32 = 0;
    let mut commit_sha: Option<String> = None;
    let mut message: Option<String> = None;

    for raw in stdout.lines() {
        let line = raw.trim_end();
        if let Some(rest) = line.strip_prefix("Pushed ") {
            // "Pushed N file(s) -> origin/main"
            if let Some((n, _)) = rest.split_once(" file(s)") {
                pushed = n.trim().parse().unwrap_or(0);
            }
        } else {
            let trimmed = line.trim_start();
            if let Some(rest) = trimmed.strip_prefix("commit ") {
                let mut it = rest.splitn(2, ' ');
                commit_sha = it
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                message = it
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
            }
        }
    }

    PushResult {
        pushed,
        commit_sha,
        message,
        nothing_to_push: false,
    }
}

pub fn parse_pull(stdout: &str) -> PullResult {
    // Order matters: "Merged with conflicts" must beat "Merged ".
    if let Some(idx) = stdout.find("Merged with conflicts in ") {
        let tail = &stdout[idx + "Merged with conflicts in ".len()..];
        let files = take_leading_u32(tail);
        return PullResult {
            kind: "conflict".to_string(),
            files,
            commit_sha: None,
            conflict_files: files,
        };
    }
    if let Some(idx) = stdout.find("Initialized from ") {
        // "Initialized from origin/main (N file(s))"
        let tail = &stdout[idx..];
        let files = parse_paren_count(tail);
        return PullResult {
            kind: "initialized".to_string(),
            files,
            commit_sha: None,
            conflict_files: 0,
        };
    }
    if let Some(idx) = stdout.find("Fast-forwarded ") {
        let tail = &stdout[idx + "Fast-forwarded ".len()..];
        let files = take_leading_u32(tail);
        return PullResult {
            kind: "fast_forward".to_string(),
            files,
            commit_sha: None,
            conflict_files: 0,
        };
    }
    if let Some(idx) = stdout.find("Merged ") {
        // "Merged N file(s) and committed as <sha7>"
        let tail = &stdout[idx + "Merged ".len()..];
        let files = take_leading_u32(tail);
        let commit_sha = tail
            .split_once("committed as ")
            .map(|(_, sha)| sha.split_whitespace().next().unwrap_or("").to_string())
            .filter(|s| !s.is_empty());
        return PullResult {
            kind: "auto_merge".to_string(),
            files,
            commit_sha,
            conflict_files: 0,
        };
    }
    PullResult {
        kind: "unknown".to_string(),
        files: 0,
        commit_sha: None,
        conflict_files: 0,
    }
}

fn take_leading_u32(s: &str) -> u32 {
    let digits: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().unwrap_or(0)
}

fn parse_paren_count(s: &str) -> u32 {
    // Find "(N file(s))" anywhere after start.
    if let Some(open) = s.find('(') {
        let after = &s[open + 1..];
        if let Some((n, _)) = after.split_once(" file(s)") {
            return n.trim().parse().unwrap_or(0);
        }
    }
    0
}

pub fn parse_doctor(stdout: &str) -> DoctorResult {
    let mut checks: Vec<DoctorCheck> = Vec::new();
    let mut overall = "FAIL".to_string();

    let lines: Vec<&str> = stdout
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    if let Some(last) = lines.last() {
        if let Some(level) = extract_bracket(last) {
            if matches!(level.as_str(), "PASS" | "WARN" | "FAIL") {
                overall = level;
            }
        }
    }

    let parse_until = if lines.is_empty() { 0 } else { lines.len() - 1 };
    for line in lines.iter().take(parse_until) {
        if let Some(level) = extract_bracket(line) {
            let body = line.split_once(']').map(|x| x.1).unwrap_or("").trim_start();
            // claude-sync prints "[LEVEL] name — detail" with U+2014 em-dash;
            // accept the ASCII " - " variant too so the parser stays robust to format drift.
            let split = body.split_once(" — ").or_else(|| body.split_once(" - "));
            let (name, detail) = match split {
                Some((n, d)) => (n.trim().to_string(), d.trim().to_string()),
                None => (body.trim().to_string(), String::new()),
            };
            checks.push(DoctorCheck {
                level,
                name,
                detail,
            });
        }
    }

    DoctorResult { overall, checks }
}

fn extract_bracket(line: &str) -> Option<String> {
    let rest = line.strip_prefix('[')?;
    let (inner, _) = rest.split_once(']')?;
    Some(inner.trim().to_string())
}

/// Pulls the configured remote URL out of a parsed doctor result.
/// Matches the `remote origin` check (see claude-sync src/commands/doctor.rs#check_origin_remote).
/// Returns None when the check is missing, has no URL, or reports "not configured".
/// Currently consumed by the frontend via the typed DoctorResult; kept Rust-side too
/// in case a future Tauri command wants to short-circuit and return just the URL.
#[allow(dead_code)]
pub fn extract_remote_url(doctor: &DoctorResult) -> Option<String> {
    for check in &doctor.checks {
        if check.name.eq_ignore_ascii_case("remote origin") {
            let d = check.detail.trim();
            if d.is_empty() || d == "(no url)" || d.starts_with("not configured") {
                return None;
            }
            return Some(d.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_full() {
        let s = "Branch: main (ahead 2, behind 0)\n\
                 Changes:\n  M  settings.json\n  A  agents/new-agent.md\n  D  hooks/old-hook.md\n\
                 Tracking 14 file(s) (excluded: 3 by .stowignore / 0 by .gitignore)\n";
        let r = parse_status(s);
        assert_eq!(r.branch, "main");
        assert_eq!(r.ahead, 2);
        assert_eq!(r.behind, 0);
        assert_eq!(r.tracked, 14);
        assert_eq!(r.excluded_stow, 3);
        assert_eq!(r.excluded_git, 0);
        assert_eq!(r.changes.len(), 3);
        assert_eq!(r.changes[0].kind, "M");
        assert_eq!(r.changes[0].path, "settings.json");
        assert_eq!(r.changes[1].kind, "A");
        assert_eq!(r.changes[2].kind, "D");
    }

    #[test]
    fn status_nothing_changed() {
        let s = "Branch: main (ahead 0, behind 0)\n\
                 Nothing changed\n\
                 Tracking 14 file(s) (excluded: 0 by .stowignore / 0 by .gitignore)\n";
        let r = parse_status(s);
        assert_eq!(r.branch, "main");
        assert_eq!(r.changes.len(), 0);
        assert_eq!(r.tracked, 14);
    }

    #[test]
    fn push_success() {
        let s = "Pushed 3 file(s) -> origin/main\n  commit abc1234 sync: updated agents\n";
        let r = parse_push(s);
        assert_eq!(r.pushed, 3);
        assert_eq!(r.commit_sha.as_deref(), Some("abc1234"));
        assert_eq!(r.message.as_deref(), Some("sync: updated agents"));
        assert!(!r.nothing_to_push);
    }

    #[test]
    fn push_nothing() {
        let r = parse_push("Nothing to push\n");
        assert!(r.nothing_to_push);
        assert_eq!(r.pushed, 0);
        assert!(r.commit_sha.is_none());
    }

    #[test]
    fn pull_initialized() {
        let r = parse_pull("Initialized from origin/main (5 file(s))\n");
        assert_eq!(r.kind, "initialized");
        assert_eq!(r.files, 5);
    }

    #[test]
    fn pull_fast_forward() {
        let r = parse_pull("Fast-forwarded 3 file(s)\n");
        assert_eq!(r.kind, "fast_forward");
        assert_eq!(r.files, 3);
    }

    #[test]
    fn pull_auto_merge() {
        let r = parse_pull("Merged 4 file(s) and committed as def5678\n");
        assert_eq!(r.kind, "auto_merge");
        assert_eq!(r.files, 4);
        assert_eq!(r.commit_sha.as_deref(), Some("def5678"));
    }

    #[test]
    fn pull_conflict() {
        let s = "Merged with conflicts in 2 file(s) - resolve and run 'claude-sync push'.\n\
                 JSON conflict files contain a '_conflicts' array key - review and remove it, then run 'claude-sync push'.\n";
        let r = parse_pull(s);
        assert_eq!(r.kind, "conflict");
        assert_eq!(r.conflict_files, 2);
        assert_eq!(r.files, 2);
    }

    #[test]
    fn doctor_pass() {
        let s = "[OK] git installed - v2.43.0\n\
                 [OK] claude dir - C:\\Users\\xx\\.claude exists\n\
                 [OK] remote reachable - origin/main\n\
                 [PASS]\n";
        let r = parse_doctor(s);
        assert_eq!(r.overall, "PASS");
        assert_eq!(r.checks.len(), 3);
        assert_eq!(r.checks[0].level, "OK");
        assert_eq!(r.checks[0].name, "git installed");
        assert_eq!(r.checks[0].detail, "v2.43.0");
    }

    #[test]
    fn doctor_em_dash_and_remote_url() {
        // Real claude-sync output uses U+2014 em-dash, not ASCII hyphen.
        let s = "[OK] git binary — git version 2.43.0\n\
                 [OK] remote origin — https://github.com/foo/bar.git\n\
                 [PASS]\n";
        let r = parse_doctor(s);
        assert_eq!(r.overall, "PASS");
        assert_eq!(r.checks.len(), 2);
        assert_eq!(r.checks[1].name, "remote origin");
        assert_eq!(r.checks[1].detail, "https://github.com/foo/bar.git");
        assert_eq!(
            extract_remote_url(&r).as_deref(),
            Some("https://github.com/foo/bar.git"),
        );
    }

    #[test]
    fn extract_remote_url_missing() {
        let r = DoctorResult {
            overall: "FAIL".to_string(),
            checks: vec![DoctorCheck {
                level: "FAIL".to_string(),
                name: "remote origin".to_string(),
                detail: "not configured".to_string(),
            }],
        };
        assert!(extract_remote_url(&r).is_none());
    }

    // v0.2.5 regression: libgit2's status with recurse_untracked_dirs=false
    // emits untracked directories as "daemon/" with a trailing slash. These
    // entries are not files, so parse_change_entry must drop them — otherwise
    // FileTree.groupByDir downstream creates a child node with an empty
    // `name` and the UI shows a blank, unselectable row.
    #[test]
    fn trailing_slash_entry_returns_none() {
        assert!(super::parse_change_entry("  ?  daemon/").is_none());
        assert!(super::parse_change_entry("  ??  cache/").is_none());
        // Even a single trailing slash on a nested-looking path must be
        // rejected — the trailing slash is the directory signal.
        assert!(super::parse_change_entry("  M  agents/sub/").is_none());
    }

    #[test]
    fn trailing_backslash_entry_returns_none() {
        // Defensive: on Windows the sidecar could conceivably hand back a
        // backslash-terminated directory. We treat it the same as `/`.
        assert!(super::parse_change_entry("  ?  daemon\\").is_none());
    }

    // End-to-end: parse_status with a trailing-slash entry mixed in must
    // produce a clean changes list where every entry has a non-empty path.
    #[test]
    fn status_with_trailing_slash_produces_no_empty_path() {
        let s = "Branch: main (ahead 0, behind 0)\n\
                 Changes:\n  ?  daemon/\n  ?  ok.md\n\
                 Tracking 1 file(s) (excluded: 0 by .stowignore / 0 by .gitignore)\n";
        let r = parse_status(s);
        assert_eq!(r.changes.len(), 1);
        assert_eq!(r.changes[0].path, "ok.md");
        assert!(!r.changes.iter().any(|c| c.path.is_empty()));
    }

    #[test]
    fn doctor_fail() {
        let s = "[OK] git installed - v2.43.0\n\
                 [WARN] stowignore present - missing recommended entry\n\
                 [FAIL] remote reachable - dns lookup failed\n\
                 [FAIL]\n";
        let r = parse_doctor(s);
        assert_eq!(r.overall, "FAIL");
        assert_eq!(r.checks.len(), 3);
        assert_eq!(r.checks[2].level, "FAIL");
        assert_eq!(r.checks[2].name, "remote reachable");
        assert_eq!(r.checks[2].detail, "dns lookup failed");
    }
}
