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
- `[remote 'origin']` (single-quoted) and tab-indented section headers in
  `~/.claude/.git/config` — `set_remote` currently only handles the canonical
  `[remote "origin"]` form.
- README — add a one-line note about the in-app Korean/English language toggle.

OAuth / `v0.2.1` follow-ups (from the v0.2 critic review):

- Allow cancel during in-flight `device_start` invoke — `InitScreen` currently
  drops late `Esc` / back-button presses while the first GitHub round-trip is
  still pending (W3).
- Add next-action guidance after GitHub logout in the Settings modal so the
  user knows the next step is "sign in again" rather than a bare empty state
  (W4).
- Rework `github.auth.enter-code-at` to split URL from label — the current
  i18n key embeds the verification URL via `{url}` which leaves a stray
  empty token in the rendered copy (S1).
- Replace substring match with structured error code parsing in
  `github::create_repo` — the Rust side currently scans the 422 body text
  instead of using GitHub's `errors[].code` field (S2).
- Extend `GitHubAuthFlow.test.tsx` for `slow_down` / `denied` / network paths
  to round out the device-flow coverage matrix (S3).
- Optional description field in `RepoCreator` so users can ship a one-liner
  to GitHub alongside the name (S4).

## [0.2.11] - 2026-05-22

Hotfix surfaced by a friend-PC dogfood pass. Two recoveries land in this
release: (1) `init` was not running an initial `fetch`, so a fresh clone with
an unborn local `main` and `behind=0` could stall in a "looks-synced-but-isn't"
state, and (2) the default `.stowignore` shipped by the `claude-sync` sidecar
was missing leading-dot secret files (`.credentials.json` and friends) that
the UI's `DEFAULT_STOWIGNORE` already excluded, so a fresh repo's first push
could leak those secrets.

### Sidecar (claude-sync v0.1.2)
- **`init.rs` `try_initial_fetch`.** Best-effort `git fetch` immediately
  after `init` + `remote add`, using the remote's default refspec (empty
  slice `&[]` → libgit2 falls back to `+refs/heads/*:refs/remotes/origin/*`)
  so `main`, `master`, or any other default branch all work. Silent on
  failure so an empty `origin` (brand-new GitHub repo with no commits yet)
  remains a valid starting state — the fetch only matters when the remote
  already has history that the new PC needs to learn about. Emits a
  `note:` line to stderr when the fetch is skipped so future debugging
  has a breadcrumb.
- **`.stowignore.default` expanded from 21 → 49 lines.** Added
  `.credentials.json`, `history.jsonl`, `daemon/`, `daemon.lock`,
  `daemon.status.json`, `sessions/`, `session-env/`, `session-data/`,
  `image-cache/`, `paste-cache/`, `backups/`, `ide/`, `.serena/`,
  `plugins/marketplaces/`, `.last-cleanup`, `mcp-needs-auth-cache.json`,
  `debug/`, `jobs/`, `file-history/`, and `shell-snapshots/` — kept in
  sync with the UI's `DEFAULT_STOWIGNORE` constant so the two layers no
  longer disagree on what counts as a secret or local-only artefact.
  (`todos/` and the redundant `daemon.log` line were intentionally dropped
  during review — `todos/` is a generic directory name some users sync on
  purpose, and `daemon.log` is already covered by the existing `*.log`.)
- Sidecar binary SHA-256: `66326236860456fbbfbb3deaba72e226e85f00c8e7a7268fa6e0e2018637c88d`

### Tests
- **4 new cargo tests** — `default_excludes_dot_credentials`,
  `default_excludes_history_and_daemon`,
  `default_does_not_match_normal_sync_paths` (negative coverage for the
  broad new patterns vs `CLAUDE.md` / `agents/` / `commands/` / `skills/`
  / `rules/` / `hooks/`), and `try_initial_fetch_does_not_panic_on_no_remote`.
  Total cargo test count is now 39 passing, and `cargo clippy
  --all-targets -- -D warnings` remains clean.

## [0.2.10] - 2026-05-21

Hotfix surfaced by the same second-PC dogfood that produced v0.2.9: the new
DEFAULT patterns matched, but the "Create .stowignore" action still threw
`stowignore_exists` on a file the user had just hand-edited, so the next
init still tripped on a freshly detected pattern. The version label in the
top bar was also still reading "MVP" three releases after MVP.

### Added
- **Visible app version in the Header.** Replaces the static "MVP" label
  with `v{__APP_VERSION__}` sourced from `package.json` via a Vite `define`
  so the value can't drift between the bundle and what users see.
- New i18n keys `error-banner.smart-stowignore-appended` and
  `error-banner.stowignore-already-complete` (en + ko lock-step) covering
  the two new outcomes of the upsert path.

### Changed
- **`create_smart_stowignore` is now upsert.** When `.stowignore` already
  exists it appends only the missing detected paths under an
  `# Auto-detected from secret-scan (appended)` section, preserving the
  user's hand-edits line-for-line. Return type is now `StowignoreResult
  { action, entries_written }` where `action` ∈ `"created" | "appended" |
  "no_change"`. The `stowignore_exists` error is no longer thrown — the
  FE 3-way branch picks the matching toast.
- `api.ts::createDefaultStowignore` marked `@deprecated` (kept for
  callers that haven't migrated; smart variant is the recommended path).

### Tests
- 5 new cargo tests for `build_appended_stowignore_body` covering
  empty-input / all-missing / partial-match / all-present / outside-claude-dir,
  bringing the lib total to 67.

## [0.2.9] - 2026-05-20

Second-PC dogfood report: `claude-sync init` on a second machine refused with
11 potential secrets, including two new patterns not covered by the v0.2.3
DEFAULT_STOWIGNORE (`session-data/` and `plugins/marketplaces/everything-claude-code/`).
The user clicking "Create .stowignore" only added the default body, leaving
the new patterns to fail on the very next init.

### Changed
- **DEFAULT_STOWIGNORE broadened.** Added `session-data/` to the per-machine
  state group and replaced the specific
  `plugins/marketplaces/thedotmack/cursor-hooks/STANDALONE-SETUP.md` line with
  `plugins/marketplaces/` so any current and future marketplace plugin
  fixtures stay local. The old line is harmlessly subsumed by the broader
  pattern.

### Added
- **Smart .stowignore generation.** The "Create .stowignore" action now
  parses the sidecar's secret-scan stderr, extracts the absolute paths it
  flagged, and asks the new `create_smart_stowignore` Tauri command to
  append them under a `# Auto-detected from secret-scan` section in
  addition to the default body. One click recovers from the secret scan on
  any machine, not just the one whose patterns happened to match the
  default. Empty detected array → behaves identically to the previous
  default-only path, so the regression surface is zero.
- `parseSecretScanPaths(stderr)` pure helper in `src/lib/stowignore.ts`
  with five vitest cases (Windows payload, empty stderr, no secret-scan
  lines, POSIX paths, deduplication) plus a length cap to avoid
  pathological regex matching on malformed input.
- `build_smart_stowignore_body(default, claude_dir, detected)` pure Rust
  helper with six cargo tests pinning the empty / single / multiple /
  duplicate / outside-claude-dir / Windows-case-mismatch branches. The
  case-mismatch fallback strips paths via lowercased POSIX-normalised
  prefix comparison, so a sidecar emitting `c:\Users\…` while
  `resolve_claude_dir()` returns `C:\Users\…` still resolves correctly.
- `path_outside_claude_dir` error string now has a dedicated i18n key
  (`error-banner.path-outside-claude-dir`) instead of leaking the raw
  identifier into the toast.

### Notes
- The existing `stowignore_exists` guard is kept — users who hand-edited
  their `.stowignore` are never overwritten; they get the
  `Edit it manually` info toast instead.
- The Rust path scope check (`strip_prefix(claude_dir)`) is the primary
  defence; the case-insensitive fallback is a safety net for the specific
  Windows drive-letter mismatch class only.

## [0.2.8] - 2026-05-20

Hotfix: surfaced GitHub logout as a prominent entry point in the app header.

### Added
- **Header "Sign out" button.** When a GitHub account is connected, an
  amber-coloured "Sign out" button now appears in the top bar next to the
  Settings/Refresh buttons. Previously the only way to disconnect was the
  buried "Disconnect GitHub" entry inside the Settings modal — users
  couldn't find it (v0.2.7 dogfood report).
- `header.github-logout` / `header.github-logout-success` i18n keys (en + ko).
- `Header.test.tsx` with three vitest cases: login state shows the button,
  logout state hides it, click invokes `github_logout` and shows a success
  toast.

### Notes
- The existing "Disconnect GitHub" entry in the Settings modal is retained
  for completeness; both entry points call the same `github_logout` Tauri
  command. Logout-related state in the two components is independent —
  SettingsModal re-checks `githubIsLoggedIn` on every open.
- App.test.tsx fixtures updated to mock `github_is_logged_in: false` so the
  newly-added Header mount-time check doesn't trip "no route registered"
  on the integration tests.

## [0.2.7] - 2026-05-20

Second hotfix on top of v0.2.6. The v0.2.6 verification (sidecar status
re-call) turned out to silently pass through the ghost-push scenario:
when the sidecar's push never pushed to origin, `refs/remotes/origin/<branch>`
was missing locally and the sidecar's `status` reported `ahead=0` as a
fallback — letting the bogus success through our gate.

v0.2.7 replaces sidecar-status verification with direct GitHub queries.

### Changed
- **Push verification no longer trusts the sidecar.** After a non-trivial
  push, the Tauri layer now spawns three independent git subprocesses:
  `rev-parse --abbrev-ref HEAD` (current branch), `rev-parse HEAD`
  (local commit SHA), and `ls-remote origin <branch>` (remote SHA from
  GitHub). The push is accepted only when the remote SHA equals the
  local HEAD. Any other outcome — including an empty remote ref,
  a SHA mismatch, a non-zero exit, or a 10-second timeout — surfaces
  `push_unverified:` to the FE.
- Removed the `verify_push_status(ahead: u32)` helper and its two
  cargo tests; they were unable to distinguish a real push from the
  sidecar's `ahead=0` fallback.
- Updated the `app.push-unverified` toast copy to mention both
  "sidecar bug" and "network issue" since ls-remote can fail either way.

### Added
- `parse_ls_remote_output(stdout: &str) -> Option<String>` pure helper
  plus six cargo tests pinning the output formats git emits (normal,
  empty, multi-ref, trailing whitespace, CRLF, no-tab).
- New direct tokio dependency in `Cargo.toml` with `process` and `time`
  features for `tokio::process::Command` and `tokio::time::timeout`.

### Notes
- ls-remote is a fetch-only operation — Git Credential Manager (already
  used for fetch in v0.2.5+) handles auth cache. No new credential
  requirements.
- The 10-second timeout protects against a hung ls-remote (e.g. when
  `GIT_TERMINAL_PROMPT=0` is not set and credentials are missing).
  Future v0.2.8 candidate: set `GIT_TERMINAL_PROMPT=0` on the subprocess
  env to fail fast instead of timing out.
- The upstream `claude-sync` sidecar push bug remains; v0.2.7 just makes
  the GUI tell you the truth about it.

## [0.2.6] - 2026-05-20

Hotfix for a silent push failure discovered during the v0.2.5 dogfood:
the sidecar printed "Pushed 1460 file(s) → origin/main" with exit 0 but
the remote (`size=0`, `branches=[]`) was never updated. Local commits
were created normally — only the `git push` stage was either skipped or
swallowed by the sidecar's `push` subcommand.

### Fixed
- **Detect ghost-push (sidecar false success).** After a non-trivial push,
  the Tauri `push` command re-runs `status` and confirms `ahead` dropped
  to 0. If the sidecar lied, we surface a dedicated `push_unverified`
  error and the GUI shows: "Push did not reach GitHub — sidecar reported
  success but origin was not updated. This is a sidecar bug. Run
  `git push` manually or wait for the next sidecar release."
- "Nothing to push" results skip the verification (no remote state was
  expected to change). A `Not initialized` status response after push is
  treated as benign — InitScreen will reappear on next refresh.

### Notes
- The fix lives entirely in the Rust layer (`commands.rs` +
  `verify_push_status` pure helper); the sidecar itself is patched
  separately in the `claude-sync` repo.
- Two new cargo tests pin the helper's two branches; two new vitest
  cases (`App.test.tsx`) confirm the FE shows the dedicated warning
  for `push_unverified:` errors and stays silent for normal pushes.
- v0.2.5 Known follow-ups (Korean localised error mapping, `commands.rs`
  split) still pending — both queued for v0.3 along with the
  `run_sidecar` timeout (the post-push status re-call now makes the
  no-timeout behaviour twice as visible).

## [0.2.5] - 2026-05-20

Second-pass hotfix after the v0.2.4 dogfood. Two new user reports from the
same screenshot session:

1. Some directory headers show `(1)` but their child rows are blank with
   just a `?` badge floating on the right — "the folder counts a file
   but there's no file visible."
2. "Can I double-click a file to open it in my editor?"

This release answers both.

### Fixed
- **No more blank rows for untracked-directory sentinels.** libgit2 inside
  the sidecar emits the directory path itself (e.g. `daemon/` with a
  trailing slash) when `recurse_untracked_dirs` is off, which produced an
  entry with an empty display name. We now drop trailing-slash entries
  in two layers: `parse.rs` filters them at the boundary, and
  `FileTree.groupByDir` skips any row with a blank name as a
  defence-in-depth fallback in case a future sidecar regresses.
- **Empty-state message takes over when every entry was filtered.** The
  FileTree "no changes" message keyed off `changes.length === 0`; with
  the new filter, a status that contained only directory sentinels would
  otherwise render an empty `<ul>`. It now keys off `groups.length === 0`.

### Added
- **Double-click a file row to open it in the OS default editor.** Backed
  by a new `open_in_editor` Tauri command that runs the path through a
  multi-stage validator before handing it to the opener plugin:
  empty/`.`/control chars rejected up-front; absolute paths, UNC paths,
  `..` traversal, mid-path `./` patterns (which `Path::components()`
  silently normalises away), and Windows reserved device names
  (`NUL`/`CON`/`COM1-9`/`LPT1-9`/`AUX`/`PRN`, case-insensitive,
  including `NUL.txt` extension variants) all rejected by name.
  `canonicalize()` then resolves the file and the result must
  `starts_with` the canonical `claude_dir` — symlink-escape attempts are
  caught here. Stable Rust error strings (`empty_path_rejected`,
  `path_traversal_rejected`, `reserved_device_name`, etc.) are surfaced
  on failure; for now they appear in the toast verbatim — a localised
  mapping is queued for v0.2.6.

### Notes
- No sidecar/CLI change. The upstream root cause for the empty-name rows
  is `claude-sync/src/commands/status.rs` not setting
  `recurse_untracked_dirs(true)` on its libgit2 status options; this
  release works around it in the UI layer so the bundled sidecar binary
  stays unchanged.
- The Rust opener path takes the trust-boundary cut: validation lives in
  `validate_open_path` (a pure helper, no `AppHandle`) and is fully unit
  tested. The `#[tauri::command]` thin-wraps it with the opener call.
  Going through Rust also avoids widening the `opener:allow-open-path`
  capability — the plugin's Rust API doesn't go through the IPC ACL.
- New regression coverage: ten new cargo tests pinning the 5+ validator
  branches (absolute/UNC/`..`/empty/control/reserved-name/`./`/missing
  file/accepted-existing-file) plus three vitest cases for the FileTree
  side (sentinel skip, double-click invokes `onFileOpen`, filtered-out
  rows are inert).

### Known follow-ups (v0.2.6)
- Map stable Rust error strings to Korean/English toast copy so the
  `Failed to open file: reserved_device_name` message doesn't leak the
  raw identifier to end users.
- `commands.rs` is approaching the 800-LOC guideline limit; split the
  editor-related helpers into `editor.rs`.

## [0.2.4] - 2026-05-20

Hotfix release covering three issues a first-time user surfaced after the
v0.2.3 secret-scan recovery. They got past `init`, landed on the main
screen, and asked three concrete questions:

1. The bottom `Push 0↑` button never lights up.
2. Clicking the `▼` next to a directory does nothing.
3. "PCs have different projects/ — that's excluded, right?"

This release answers all three.

### Fixed
- **ActionBar — push button enables when there are uncommitted local
  changes, not only when `ahead > 0`.** The button is now active whenever
  a successful push would land at least one commit on origin (= `ahead`
  + 1 if there is anything to stage). Covers both the post-init
  unborn-branch state (no commits yet, just untracked files) and the
  ordinary working-tree-edits-without-a-commit state.
- **Conflict entries no longer count toward push, and any unresolved
  conflict hard-disables the button.** A `claude-sync status` change
  with kind `!` is an unresolved conflict; the existing Resolve Conflicts
  button handles those. Even if other staged changes exist alongside a
  conflict, push stays disabled — pushing a half-merged tree would land
  a `_conflicts`-key payload on origin and break peers on next pull.
- **FileTree directory groups now collapse/expand on click.** The `▼`
  glyph looked like a button in v0.2.3 but was inert; clicking it
  toggles the group between `▼` (expanded) and `▶` (collapsed) and the
  button carries proper `aria-expanded` state. Default = expanded; the
  state is per-session (not persisted), since which directories the user
  cares about depends on what changed *this* session.

### Added
- **`.stowignore` inspector modal** so the user can self-verify exactly
  which paths are skipped from sync. The FileTree footer now shows a
  "What's excluded?" link (only when there are exclusions to show)
  that opens a modal displaying the contents of `~/.claude/.stowignore`.
  Backed by a new `read_stowignore` Tauri command. This directly answers
  the "does projects/ get synced or not?" dogfood question — the rule
  is now visible in the UI instead of having to trust an opaque
  "excluded: stow 3314" counter.

### Notes
- The push label remains `Push N↑`. `N` is the count of commits that
  will be on origin after the push completes (existing `ahead` + 1
  staged commit if any uncommitted change is present, conflicts
  excluded).
- No sidecar/CLI changes — the sidecar's `push` command already handled
  all three states (clean, pending changes, unborn) correctly; only the
  UI gate was wrong.
- New regression coverage:
  - `ActionBar.test.tsx` pins nine push-button enable/disable states.
  - `FileTree.test.tsx` adds four cases for the toggle behaviour and
    the "What's excluded?" link visibility rules.
  - `StowignoreModal.test.tsx` covers loading / body / empty / error /
    Escape-to-close / button-to-close branches.

## [0.2.3] - 2026-05-19

Hotfix release. The v0.2.2 manual-init path correctly surfaced the
underlying error after a successful repo creation, but when
`claude-sync init` was refused by the upstream secret scanner with a
40+ line list of detected API keys, the error message visually
swallowed the entire `ManualRemoteForm` screen and the dismiss
affordance was unreachable on top of the rendered text — leaving the
user with no path out except force-quitting the app.

### Fixed
- **ErrorBanner — long messages no longer drown the screen.** Messages
  longer than 200 chars or 3+ lines are now truncated to a 2-line
  preview with an `aria-expanded` "Show full message / Show less"
  toggle. The dismiss control (`✕`) sits in a fixed 40×40 hit target
  at the top-right corner and is always reachable; even a fully
  expanded message is capped at `max-h-[40vh]` with `overflow-y-auto`
  so the action row stays visible.
- **`ManualRemoteForm` now uses `ErrorBanner` for external errors**
  instead of a raw `<p>` so the same collapsing rules apply on the
  init-failed path (which is where v0.2.2 dogfooders actually got
  trapped — not on the live `ErrorBanner` channel).

### Added
- **One-click `.stowignore` recovery.** When the error matches the
  upstream secret-scan signature (`"Refusing to initialize: found"`
  / `"potential secret(s)"`), an amber "Create .stowignore" action
  button appears next to the toggle. Clicking it invokes the new
  Tauri command `create_default_stowignore` which atomically writes
  a curated `~/.claude/.stowignore` (credentials, history.jsonl,
  file-history/, daemon runtime, marketplace example docs) so the
  user can immediately re-run Initialize without leaving the app.
  Existing `.stowignore` files are never overwritten — the command
  returns `stowignore_exists` and the UI surfaces a localized hint.
- **Three new `cargo test` cases** exercising the stowignore writer
  with real per-thread temp directories: happy path, existing-file
  guard, and missing-directory guard.

### Tests
- `cargo test`: 32 → **35 PASS** (+3 stowignore unit tests)
- `vitest`: 49 → **62 PASS** (+13 across `ErrorBanner.test.tsx` —
  short/long collapsing, secret-scan heuristic with 6 fixtures,
  recovery action callback, dismiss reachability)
- `cargo clippy --all-targets -D warnings`: clean
- `tsc --noEmit`: clean

## [0.2.2] - 2026-05-19

Hotfix release. The v0.2.1 OAuth path created the private repo
successfully on GitHub but then got stuck on the `RepoCreator` screen
when the subsequent `claude-sync init` step failed (typically: git
HTTPS push without configured credentials). No toast, no error, no
step transition — just a silent dead-end.

### Fixed
- **`RepoCreator` no longer swallows `onSubmit` rejection** — the
  `onCreated` callback now `await`s the parent's init promise inside
  its try block and re-throws on rejection so the spinner stays
  visible until the real outcome is known. `InitScreen` then catches
  the rejection, transitions `step` back to `'choose'`, pre-fills
  `ManualRemoteForm` with the just-created `clone_url`, and renders a
  `role="status"` recovery hint above the form
  (`init-screen.repo-created-init-failed`).
- The underlying push failure is now surfaced through the normal
  `ErrorBanner` channel as well, so the user can read the actual git
  message (e.g. `"fatal: could not read Username for ..."`) instead
  of guessing.

### Added
- New i18n keys `init-screen.repo-created-init-failed` (EN + KO)
  with explicit guidance: "Repository was created on GitHub. Set up
  git credentials or switch to the SSH URL, then click Initialize."
- Regression test `InitScreen.test.tsx — surfaces init failure after
  successful repo creation` reproduces the exact v0.2.1 stuck-screen
  scenario.

### Known limitation (deferred to v0.2.3)
This release surfaces the failure but does **not** automatically wire
the OAuth access token into Windows' `git credential-manager` for
HTTPS pushes. Users who hit this path still need to either:
1. Have a working `git credential-manager` (ships with Git for
   Windows) — first push triggers GCM's own GitHub OAuth flow, OR
2. Add an SSH key to GitHub and switch the pre-filled remote URL
   from `https://...` to the `git@github.com:...` form before
   clicking Initialize.

v0.2.3 will add an opt-in toggle to mirror our OAuth token into
`git credential-manager` so the HTTPS path "just works" after a
single sign-in.

## [0.2.1] - 2026-05-19

Hotfix release. The v0.2.0 GitHub Device Flow sign-in appeared to
succeed but the access token was silently dropped on the way to the
Windows Credential Manager, so the very next step ("Create private
repository") immediately reported "Please sign in to GitHub first."

### Fixed
- **GitHub access token now actually persists on Windows** — root
  cause was a missing per-platform backend feature on the `keyring`
  crate. `keyring = "3"` with no features compiles into a no-op
  store: `set_password` returns `Ok(())` while the credential vault
  is never touched. `Cargo.toml` now activates `windows-native` on
  Windows, `apple-native` on macOS, and `linux-native-sync-persistent
  + crypto-rust` on Linux via `[target.'cfg(...)'.dependencies]`
  blocks so the OS-native backend is always compiled in.
- **`poll_device_flow` save round-trip verification** — after
  `save_token()` returns, `github.rs` now immediately calls
  `load_token()` and compares the result to the freshly issued
  access token. A mismatch (or a load failure right after a
  successful save) is surfaced as `keyring_save_failed` /
  `keyring_round_trip_failed` / `keyring_round_trip_mismatch`
  instead of silently letting `status="success"` propagate to the
  UI. Same-shape regression of the v0.2.0 bug will now fail loudly
  at the first sign-in attempt.

### Added
- Two new `cargo test` cases exercising the **real OS keyring
  backend** — `save_load_round_trip_persists_token` and
  `delete_then_load_returns_not_logged_in`. Tests use unique
  `claude-sync-ui-test-{suffix}-{pid}-{nanos}` service names and
  always clean up so user credentials are never touched. `cargo
  test`: 30 → 32 PASS.

### Setup (unchanged from v0.2.0)
Self-hosters / forks: `$env:GITHUB_CLIENT_ID = "Ov23li..."` before
`npm run tauri build`. The placeholder build still compiles but the
Device Flow request is rejected by GitHub at runtime.

## [0.2.0] - 2026-05-19

Major feature release. Adds GitHub Device Flow sign-in and automatic
private repository creation directly from the InitScreen — first-time
users can now go from "nothing" to a synced `~/.claude/` without leaving
the app.

### Added
- **GitHub Device Flow sign-in** — InitScreen now offers a
  "Sign in with GitHub" path alongside the existing manual URL form.
  Triggers the standard OAuth Device Flow (RFC 8628): `user_code`
  displayed in-app, browser auto-opens to
  `https://github.com/login/device`, the Rust backend polls
  `/login/oauth/access_token` until success with `slow_down` backoff
  capped at 30 s. On success the access token lands in the **Windows
  Credential Manager (DPAPI)** via the `keyring` crate — never on disk,
  never in `~/.claude/` (which is itself synced).
- **Automatic private repository creation** — once authenticated, the
  user picks a repo name (default `dotclaude`) and `RepoCreator` posts
  to `https://api.github.com/user/repos` with `private: true`. The
  returned `clone_url` is wired straight into the existing `handleInit`
  flow — no copy-paste, no detour through the GitHub website.
- **`GitHubAuthFlow` component** — handles the Device Flow UI with
  recursive `setTimeout` polling, 1 Hz countdown to `expires_in`,
  Clipboard API "Copy code", and `tauri-plugin-opener` auto-launch of
  the verification URL.
- **`RepoCreator` component** — repo-name input with a client-side
  empty/whitespace guard mirroring the Rust `validate_repo_name`
  policy. Maps `not_logged_in` / 401 / 403 / 422 errors to localized
  messages.
- **`ManualRemoteForm` component** — the legacy URL input pulled out of
  `InitScreen` so the screen stays focused on step orchestration.
- **Settings — "Disconnect GitHub"** — Settings modal probes
  `github_is_logged_in` on open and exposes a logout button when
  applicable. Logout deletes the keyring entry.
- **Five new Tauri commands** — `github_device_start`,
  `github_device_poll`, `github_create_repo`, `github_is_logged_in`,
  `github_logout` (with three new serde response types).
- **Korean (한국어) translations** for the 31 new OAuth-related i18n
  keys.

### Changed
- **`InitScreen` redesign** — turned into a 4-step state machine
  (`choose` / `oauth-auth` / `oauth-repo` / `manual`) layering the OAuth
  path on top of the existing manual form. Public Props signature is
  unchanged so `App.test.tsx` integration tests still pass without
  modification.

### Security
- **Token storage** — access tokens stored in Windows Credential
  Manager (DPAPI), keyed `service="claude-sync-ui"` /
  `account="github-token"`. Account-scoped (another Windows user on the
  same machine cannot read the token). Loaded into Rust process memory
  only for the duration of a single API call and dropped immediately
  after.
- **`client_id` configuration** — embedded at compile time via
  `build.rs` reading `GITHUB_CLIENT_ID`, with a clearly fake
  `MISSING_GITHUB_CLIENT_ID` placeholder for unconfigured builds and a
  Cargo build warning that fires when the env var is unset.

### Fixed (from the v0.2 critic review)
- **Countdown-expiry race in `GitHubAuthFlow`** — an inflight
  `device_poll` that resolved *after* the 15-minute countdown elapsed
  could still fire `onSuccess` and incorrectly advance the flow.
  `clearTimers()` in the expiry branch now also sets
  `cancelledRef = true`.
- **Controlled / uncontrolled `<input>` in `RepoCreator`** — the
  repo-name field had both `value` and `defaultValue`, which triggers a
  React 19 strict-mode console warning. Removed `defaultValue` (the
  `useState("dotclaude")` initializer already supplies the same value).
- **`new_interval === 0` falsy bug** — the `slow_down` branch in
  `GitHubAuthFlow` used `&& result.new_interval` which fell through to
  the pending path when GitHub returned `0`. Now uses an explicit
  `!= null` check.

### Dependencies (new)
- `reqwest 0.12` (features: `json`, `native-tls`) — Device Flow + REST
  API calls
- `keyring 3` — Windows Credential Manager bindings

### Test stats (since v0.1.3)
- `cargo test`: 25 → **30 PASS** (+5: device-flow polling math,
  `validate_repo_name` guard, 422 mapping)
- `vitest`: 37 → **48 PASS** (+11: `GitHubAuthFlow` lifecycle,
  `RepoCreator` validation + error paths, `InitScreen` step
  transitions, countdown-race regression)
- `cargo clippy --all-targets -- -D warnings`: clean
- `tsc --noEmit`: clean
- dist JS: 220.34 → 235.28 KB (+14.94 KB / gz 68.70 → 72.00 KB)

### Setup (for self-hosters / forks)
1. Register a GitHub OAuth App with **Device Flow enabled** at
   <https://github.com/settings/developers>.
2. Set `$env:GITHUB_CLIENT_ID = "Ov23li..."` before
   `npm run tauri build`. The `MISSING_GITHUB_CLIENT_ID` placeholder
   build still compiles but the Device Flow request will be rejected by
   GitHub.

## [0.1.3] - 2026-05-19

Security release. All Windows installers (`.msi` + `.exe`) and the bundled
`claude-sync` sidecar binary are now Authenticode-signed with an EV code
signing certificate, eliminating the SmartScreen "Unrecognized app"
warning that v0.1.x unsigned builds tripped on first run.

### Security
- **Code signing** — `tauri.conf.json` declares `bundle.windows.signCommand`
  (object form: `{cmd, args[]}`) that invokes Windows SDK `signtool.exe`
  with an EV certificate (Subject `JCG Inc.`, Issuer DigiCert Trusted G4
  Code Signing RSA4096 SHA384 2021 CA1). Every `npm run tauri build`
  produces signed `.msi`, `.exe`, and a signed
  `claude-sync-x86_64-pc-windows-msvc.exe` sidecar (Tauri picks up
  `externalBin` automatically). Timestamping via
  `http://timestamp.digicert.com` so the signature stays valid past the
  certificate's `NotAfter` (2026-07-31).

### Changed
- Installer size — msi `5,804,032` → `5,840,896` B (+36 KB), nsis
  `3,551,742` → `3,611,176` B (+59 KB). Delta is the Authenticode
  signature + timestamp block.

## [0.1.2] - 2026-05-18

Hotfix + i18n release. Restores the InitScreen entry path that v0.1.x silently
skipped, adds an in-app remote URL editor, and ships Korean (한국어) UI
translations.

### Added
- **Korean (한국어) language support** — full UI translation behind a tiny
  in-house i18n runtime (`src/i18n/`, ~1 KB). Initial locale is auto-detected
  from `navigator.language` (`ko*` → Korean, otherwise English) and the user
  can switch at runtime from the Settings modal language dropdown. Selection
  persists in `localStorage` and updates `document.documentElement.lang` for
  screen readers.
- **`set_remote` Tauri command** — atomically rewrites the `[remote "origin"]`
  URL in `~/.claude/.git/config` using a pid-stamped temp file + rename. No
  sidecar shell-out, no new Rust crate.
- **Settings modal — inline `Change remote` form** — replaces the placeholder
  message with a real input, client + server-side URL validation, and inline
  success / error feedback. URL pattern is shared with `InitScreen` via
  `src/lib/remote-validation.ts` (`https://`, `ssh://`, `git@`, or absolute
  local path).
- **Auto-captured screenshots** (carried over from the
  unreleased `8af66ac` work) — three mock-mode PNGs (first run, synced,
  conflict toast) rendered via `npm run screenshots` (Playwright + system
  Edge against the stubbed `index-mock.html` Vite entry).

### Fixed
- **InitScreen no longer skipped on a fresh `~/.claude/`** — `claude-sync
  status` (and `pull`/`push`) returns exit 0 + stdout `Not initialized. ...`
  when the directory is not a git repo. The Tauri layer previously parsed this
  as an empty success and dropped the user on the main screen with no path
  back to init. `commands.rs` now shares an `is_not_initialized_stdout` guard
  across `status` / `pull` / `push` that converts this stdout into an `Err`,
  restoring the InitScreen branch.
- **`isNotInitialized` (App.tsx)** — predicate also recognizes raw git
  `not a git repository` errors so the InitScreen still appears if `git`
  itself complains before `claude-sync` has a chance to print.
- **`useRemoteUrl`** — the configured remote URL is now shown when the
  doctor `remote origin` check is `WARN` (e.g. unauthenticated fetch); the
  previous `level === "OK"` gate caused `(unknown remote)` to display even
  when the URL was perfectly fine.
- **Duplicate success toast on remote change** — `App.tsx` no longer fires
  `toast.success` in addition to the modal's inline success message.
- **`errorDismissed`** — flag now resets when the user triggers `push` /
  `pull`, so a fresh status-load failure after a sync surfaces in the
  `ErrorBanner` even when the previous error was dismissed.

### Changed
- **URL validation** — `InitScreen` and `SettingsModal` now share a single
  `REMOTE_RE` from `src/lib/remote-validation.ts`. The error copy in both
  English and Korean explicitly lists `ssh://` alongside `https://` and `git@`.
- **Window title** — `index.html` ships `<title>claude-sync</title>` (was the
  Vite/Tauri scaffolding default `"Tauri + React + Typescript"` visible on the
  Windows taskbar).

### Removed
- Dead i18n key `settings-modal.change-remote-not-supported` (English +
  Korean) — superseded by the real `Change remote` form.
- Dead duplicate branch in `isNotInitialized` (`"fatal:" && "not a git"`) —
  already covered by `"not a git repository"`.
- Dead `--version` entry in the `capabilities/default.json` sidecar args
  validator allowlist.

### Security
- **`set_remote` atomic rewrite** — uses `config.tmp.{pid}.{nanos}` for the
  staging filename so concurrent Tauri window instances or external scripts
  cannot stomp the same temp file mid-write.

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
