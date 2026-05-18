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
  "file-tree.tracking_one": "Tracking {n} file (excluded: {stow} stow, {git} git)",
  "file-tree.tracking_other": "Tracking {n} files (excluded: {stow} stow, {git} git)",

  // ActionBar
  "action-bar.push": "Push {n}↑",
  "action-bar.pull": "Pull {n}↓",
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
  "init-screen.tip": "Tip: create an empty private repo on GitHub first.",

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

  // ErrorBanner
  "error-banner.label": "Error",
  "error-banner.dismiss": "Dismiss",

  // Toast
  "toast.dismiss-aria": "Dismiss",

  // App-level toasts
  "app.action-failed": "{action} failed: {message}",
  "app.resolve-coming":
    "Conflict resolver coming in v0.2 — for now, edit ~/.claude/<file> manually and remove the '_conflicts' key, then push.",
  "app.init-success": "Initialized! ~/.claude is now synced with the remote.",

  // Doctor levels (UI badge mapping)
  "doctor.level.ok": "OK",
  "doctor.level.warn": "WARN",
  "doctor.level.fail": "FAIL",
};
