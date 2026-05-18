// Shared validation for Git remote URLs used by both InitScreen (first-run
// setup) and SettingsModal (change-remote form). Keeping these in one place
// guarantees that whatever URL the user can initialize with, they can also
// switch to later — and vice versa. Drift between the two call sites was a
// real bug pre-v0.1.2 (InitScreen omitted `ssh://`).
//
// Accepted shapes (most permissive of the two prior inline patterns):
//   - https:// or http://     (e.g. https://github.com/me/dotclaude.git)
//   - ssh://                  (e.g. ssh://git@example.com/repo.git)
//   - git@host:path           (the SCP-style shorthand most users paste)
//   - Windows drive path      (e.g. C:\path\to\repo or D:/path/to/repo)
//   - POSIX absolute path     (e.g. /srv/git/repo.git)
//
// The pattern intentionally rejects relative paths — git will treat them as
// "interpret relative to cwd" which is almost never what a desktop user wants.

export const REMOTE_RE = /^(https?:\/\/|ssh:\/\/|git@|[A-Za-z]:[\\/]|\/)/;

export function isValidRemote(url: string): boolean {
  return REMOTE_RE.test(url.trim());
}
