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
- Structured error codes from the `claude-sync` CLI (replace the current stderr
  string-matching used by `push`/`pull`/`doctor`).
- `status` returns the configured remote URL directly so `useRemoteUrl` no
  longer needs a second `doctor` round-trip.
- Differentiated exit codes from the CLI for the pull-conflict path so the
  Tauri layer can stop string-matching `"Merged with conflicts"`.

## [0.1.1] - 2026-05-17

Hotfix release. Addresses the CRITICAL + high-severity findings from the
initial v0.1.0 review.

### Security
- **Sidecar args** — `capabilities/default.json` now constrains sidecar arguments
  with a strict validator allowlist (subcommands, `-m`, and a 2048-char
  printable string) instead of the previous wide-open `"args": true`. Removes
  the argument-injection risk on the Tauri shell bridge.
- **Defense in depth** — `commands::init` now validates the remote URL in Rust
  (empty / control chars / length) before invoking the sidecar.
- **CSP restored** — `tauri.conf.json` `security.csp` is no longer `null`; ships
  a `default-src 'self'` policy that still allows Tailwind's inline styles and
  the Tauri IPC origin.

### Fixed
- **RemoteBar** — replaced the misleading `"(initialized never)"` label with
  `"(no sync yet)"` on first launch and `"Last sync: <ago>"` after a sync.
- **ErrorBanner** — the dismiss button is now wired up in `App.tsx`, so the
  status-load error can actually be closed.
- **README screenshots** — broken placeholder image references removed; a one
  line note now points at the installer until real screenshots ship.

### Changed
- **`Cargo.toml`** — replaced template placeholders (`authors = ["you"]`,
  `description = "A Tauri App"`) with the real values and added
  `license = "MIT OR Apache-2.0"` plus `repository`.
- **CI** — Windows release build now uses `cargo build --locked` (forwarded via
  `tauri build -- --locked`) so the shipped installer always matches the
  committed `Cargo.lock`.

### Removed
- **`sidecar_version` debug command** — the Day-1 smoke-test Tauri command was
  removed from `lib.rs` and the `invoke_handler!` macro; the real
  `init/status/push/pull/doctor` commands have superseded it.

### Documentation
- Sidecar binary policy documented in `README.md` with a SHA-256 of the
  bundled `claude-sync.exe` and pointer to rebuild from source.

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
