# Changelog

All notable changes to `claude-sync-ui` are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Candidates targeted for `v0.2`:

- Conflict resolver UI — side-by-side diff with merge buttons for the
  `_conflicts` JSON keys instead of the current "edit by hand" placeholder.
- Multi-PC dashboard — aggregate view of which machines are ahead / behind /
  synced.
- macOS and Linux bundles (`.dmg`, `.AppImage`, `.deb`).
- System tray with sync badge and auto-refresh on window focus.
- Optional scheduled auto-sync.

## [0.1.0] - 2026-05-17

Initial public release. Windows x64 MVP wrapping the `claude-sync` CLI.

### Added
- Five Tauri commands wired to the `claude-sync` sidecar:
  `init`, `status`, `push`, `pull`, `doctor`.
- File tree with directory grouping (`agents/`, `commands/`, `hooks/`,
  `rules/`, `skills/`, root) and colored `M / A / D / ? / !` status badges.
- Visual diff of changed files plus ahead / behind counter against the remote.
- One-click `Push`, `Pull`, `Refresh`, and `Resolve` actions with toast-based
  error surfacing.
- Init screen for first-run setup — accepts the dotclaude remote URL and
  delegates to `claude-sync init`.
- Settings modal showing the current remote URL pulled from
  `~/.claude/.git/config`.
- `claude-sync.exe` bundled as a Tauri sidecar (no separate install).
- WiX `.msi` and NSIS `.exe` installer artifacts produced by
  `npm run tauri build`.
