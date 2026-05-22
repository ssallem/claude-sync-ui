// English master dictionary. The source of truth for every key in the app.
// Other locale files (ko.ts) must satisfy this same Dict type — TypeScript
// guarantees no key drifts between locales.
//
// Naming convention: <component>.<element> (kebab-case). Interpolation uses
// `{name}` placeholders. Plurals follow the `_one` / `_other` suffix
// convention; `t()` auto-picks based on `params.n`.

import type { Dict } from "./index";

export const en: Dict = {
  // Header
  "header.settings": "Settings",
  "header.refresh": "Refresh",
  // v0.2.8 — prominent GitHub logout entry point in the top bar; the existing
  // "Disconnect GitHub" inside the Settings modal stays but users couldn't
  // find it in dogfood.
  "header.github-logout": "Sign out",
  "header.github-logout-success": "Signed out of GitHub.",

  // RemoteBar
  "remote-bar.remote-label": "Remote:",
  "remote-bar.local-label": "Local:",
  "remote-bar.no-sync-yet": "(no sync yet)",
  "remote-bar.last-sync": "Last sync: {time}",
  "remote-bar.change": "Change",

  // StatusBadge (title attributes)
  "status-badge.modified": "Modified",
  "status-badge.added": "Added",
  "status-badge.deleted": "Deleted",
  "status-badge.untracked": "Untracked",
  "status-badge.conflict": "Conflict",
  "status-badge.synced": "Synced",

  // FileTree
  "file-tree.empty": "No changes — clean",
  "file-tree.root-bucket": "(root)",
  // Base key used when t() is called without an `n` param; plural fallback to
  // _one/_other handles the normal case. Keeping this present so future
  // TranslationKey type-narrowing doesn't break the `t("file-tree.tracking", ...)`
  // call sites silently.
  "file-tree.tracking": "Tracking {n} files (excluded: {stow} stow, {git} git)",
  "file-tree.tracking_one": "Tracking {n} file (excluded: {stow} stow, {git} git)",
  "file-tree.tracking_other": "Tracking {n} files (excluded: {stow} stow, {git} git)",
  // v0.2.4 — link in the FileTree footer that opens the .stowignore inspector
  // so users can verify which per-machine paths (projects/, etc.) are skipped.
  "file-tree.show-excluded": "What's excluded?",
  // v0.2.5 — double-click a file row to open it with the OS default editor.
  "file-tree.open-in-editor": "Double-click to open in editor",
  "file-tree.open-failed": "Failed to open file: {message}",

  // StowignoreModal — inspector that displays the user's ~/.claude/.stowignore.
  "stowignore-modal.title": "Excluded from sync",
  "stowignore-modal.description":
    "Paths matching these patterns in ~/.claude/.stowignore are kept local and never pushed to the remote. Per-machine state (projects/, file-history/, daemon/) lives here.",
  "stowignore-modal.loading": "Reading .stowignore...",
  "stowignore-modal.empty":
    "No .stowignore file. Every tracked path in ~/.claude/ will be pushed.",
  "stowignore-modal.close": "Close",
  "stowignore-modal.close-aria": "Dismiss",

  // ActionBar
  "action-bar.push": "Push {n}↑",
  "action-bar.pull": "Pull {n}↓",
  // v0.2.13 — shown instead of `action-bar.pull` when the local branch is
  // `(unborn)`. There's no upstream comparison yet so "Pull 0↓" would be
  // meaningless; this label tells the user the button will fetch the remote
  // and adopt its HEAD as the first commit.
  "action-bar.pull-unborn": "Initialize from remote",
  "action-bar.resolve": "Resolve Conflicts ({n})",
  "action-bar.refresh": "Refresh",

  // StatusBar
  "status-bar.loading": "Loading status...",
  "status-bar.summary": "{ahead} ahead, {behind} behind",
  "status-bar.last-sync": "Last sync {time}",
  "status-bar.files-tracked": "{n} files tracked",
  "status-bar.branch": "branch: {branch}",

  // InitScreen
  "init-screen.welcome": "Welcome to claude-sync",
  "init-screen.description":
    "Sync ~/.claude across machines via Git. Enter the remote URL of an empty (or already-claude-sync) Git repository to begin.",
  "init-screen.remote-url-label": "Remote URL",
  "init-screen.placeholder": "https://github.com/you/dotclaude.git",
  "init-screen.invalid": "Must start with https://, ssh://, git@, or be an absolute local path.",
  "init-screen.submit": "Initialize",
  "init-screen.submitting": "Initializing...",
  "init-screen.tip": "Make sure the remote already exists and you have push access.",
  "init-screen.or": "or",
  // v0.2.2 — shown when OAuth created a repo but init failed (usually a git
  // HTTPS credential problem). The clone_url is pre-filled below so retry
  // takes one click after the user resolves the credential issue.
  "init-screen.repo-created-init-failed":
    "Your GitHub repository was created, but local init failed. The URL is pre-filled below — set up your Git credentials (or use SSH) and click Initialize to retry.",

  // SettingsModal
  "settings-modal.title": "Settings",
  "settings-modal.close-aria": "Close",
  "settings-modal.running": "Running doctor checks...",
  "settings-modal.overall": "Overall:",
  "settings-modal.change-remote": "Change remote",
  "settings-modal.close": "Close",
  "settings-modal.new-remote-label": "New remote URL",
  "settings-modal.new-remote-placeholder": "git@github.com:you/dotclaude.git",
  "settings-modal.invalid-remote": "Must start with https://, ssh://, git@, or be an absolute local path.",
  "settings-modal.update": "Update",
  "settings-modal.updating": "Updating...",
  "settings-modal.cancel": "Cancel",
  "settings-modal.update-success": "Remote updated successfully",
  "settings-modal.language": "Language",
  "settings-modal.github-logout": "Disconnect GitHub",
  "settings-modal.github-logout-success": "GitHub account disconnected.",

  // ErrorBanner
  "error-banner.label": "Error",
  "error-banner.dismiss": "Dismiss",
  "error-banner.dismiss-aria": "Dismiss error",
  "error-banner.show-more": "Show full message",
  "error-banner.show-less": "Show less",
  "error-banner.create-stowignore": "Create .stowignore",
  "error-banner.stowignore-success":
    "Default .stowignore created. Try Initialize again.",
  "error-banner.smart-stowignore-success":
    "Smart .stowignore created with {n} detected path(s) added. Try Initialize again.",
  // v0.2.9 — smart .stowignore failure: the sidecar's stderr referenced a
  // path outside ~/.claude/, so the Rust validator refused to add it. Falls
  // through to a friendly toast instead of leaking the raw error code.
  "error-banner.path-outside-claude-dir":
    "Cannot create .stowignore: a detected path is outside ~/.claude/. Edit the file manually.",
  "error-banner.stowignore-exists":
    ".stowignore already exists. Edit it manually.",
  "error-banner.smart-stowignore-appended":
    "Added {n} detected path(s) to existing .stowignore. Try Initialize again.",
  "error-banner.stowignore-already-complete":
    "Your .stowignore already covers all detected paths. The secret-scan may have a different cause.",

  // Toast
  "toast.dismiss-aria": "Dismiss",

  // App-level toasts
  "app.action-failed": "{action} failed: {message}",
  "app.resolve-coming":
    "Conflict resolver coming in v0.2 — for now, edit ~/.claude/<file> manually and remove the '_conflicts' key, then push.",
  "app.init-success": "Initialized! ~/.claude is now synced with the remote.",
  // v0.2.7 — message updated for ls-remote based verification: covers both
  // sidecar bug AND network/timeout issues since ls-remote can fail either way.
  "app.push-unverified":
    "Push did not reach GitHub — the remote ref was not updated after push. This may be a sidecar bug or a network issue. Run `git push` manually or check your connection.",

  // Doctor levels (UI badge mapping)
  "doctor.level.ok": "OK",
  "doctor.level.warn": "WARN",
  "doctor.level.fail": "FAIL",

  // GitHubAuthFlow — OAuth Device Flow UI strings.
  // Placeholders: {url} = verification_uri, {min}/{sec} = countdown components.
  "github.auth.preparing": "Preparing GitHub sign-in...",
  "github.auth.enter-code-at": "Enter this code at {url}",
  "github.auth.copy-code": "Copy code",
  "github.auth.copy-success": "Copied",
  "github.auth.open-browser": "Open in browser",
  "github.auth.expires-in": "Expires in {min}:{sec}",
  "github.auth.polling": "Waiting for you to authorize...",
  "github.auth.cancel": "Cancel",
  "github.auth.scope-notice":
    "This app requests permission to create private repositories (repo scope).",
  "github.auth.success": "Connected successfully",
  "github.auth.try-again": "Try again",
  "github.error.expired": "The code expired. Please try again.",
  "github.error.denied": "You denied the request.",
  "github.error.network": "Network error. Please check your connection.",

  // GitHub OAuth — login entry + RepoCreator screen.
  // Placeholder: none. Keys cover button labels, validation messages,
  // and the GitHub API error-string-to-i18n mapping (see github.rs).
  "github.auth.button-login": "Sign in with GitHub",
  "github.repo.title": "Create a private repository",
  "github.repo.name-label": "Repository name",
  "github.repo.private-notice": "The repository will be created as private.",
  "github.repo.description":
    "We'll create this on your GitHub account and use it to sync your settings.",
  "github.repo.create-button": "Create private repository",
  "github.repo.creating": "Creating...",
  "github.repo.back": "Back",
  "github.error.repo-taken":
    "A repository with this name already exists. Try a different name.",
  "github.error.forbidden":
    "GitHub rejected the request. Check your account permissions.",
  "github.error.token-expired":
    "Your GitHub session expired. Please sign in again.",
  "github.error.invalid-name": "Repository name cannot be empty.",
  "github.error.not-logged-in": "You need to sign in to GitHub first.",
};
