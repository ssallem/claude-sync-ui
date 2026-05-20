// Thin typed wrappers around the Tauri commands defined in src-tauri/src/commands.rs.
// Keep this file free of UI concerns — pure invoke + types.

import { invoke } from "@tauri-apps/api/core";
import type {
  StatusResult,
  PushResult,
  PullResult,
  DoctorResult,
  DeviceCodeResponse,
  DevicePollResponse,
  RepoCreateResponse,
  StowignoreResult,
} from "../types";

export const api = {
  async init(remote: string): Promise<string> {
    return invoke("init", { remote });
  },
  async status(): Promise<StatusResult> {
    return invoke("status");
  },
  async push(message?: string): Promise<PushResult> {
    return invoke("push", { message: message ?? null });
  },
  async pull(): Promise<PullResult> {
    return invoke("pull");
  },
  async doctor(): Promise<DoctorResult> {
    return invoke("doctor");
  },
  // Rewrites the `[remote "origin"]` URL in ~/.claude/.git/config in place.
  // `init` is idempotent in the sidecar (no-op on an already-initialized repo),
  // so we need a dedicated command to update the remote post-init.
  async setRemote(newUrl: string): Promise<void> {
    await invoke("set_remote", { newUrl });
  },

  /**
   * @deprecated v0.2.10 — Use createSmartStowignore instead. This command
   * fails if .stowignore already exists; smart variant upserts safely.
   */
  async createDefaultStowignore(): Promise<void> {
    await invoke("create_default_stowignore");
  },

  // v0.2.10 — upsert: returns StowignoreResult describing whether the file
  // was created, appended to, or already covered everything. Stable Err
  // strings (commands.rs::create_smart_stowignore):
  //   "claude_dir_not_found" / "path_outside_claude_dir"
  async createSmartStowignore(detectedPaths: string[]): Promise<StowignoreResult> {
    return invoke("create_smart_stowignore", { detectedPaths });
  },

  // v0.2.4 — read ~/.claude/.stowignore for the inspector modal. Returns
  // "" when the file does not exist (treated as "no exclusions configured")
  // rather than throwing — the UI shows an empty-state message instead.
  async readStowignore(): Promise<string> {
    return invoke("read_stowignore");
  },

  // -----------------------------------------------------------------------
  // GitHub OAuth Device Flow + repo creation (B-2-1 / B-2-2).
  //
  // Tauri serializes JS argument keys as camelCase → Rust snake_case, so
  // `deviceCode` on the JS side maps to `device_code` in the Rust handler.
  // The returned payload uses snake_case verbatim (no #[serde(rename_all)]
  // on the Rust structs), matching the TS interfaces in `../types`.
  //
  // `githubCreateRepo` is wired now so callers exist for B-3-2 / B-2-2;
  // the underlying Rust command lands in B-2-2. Calls before that will
  // fail with "command not found" — that's expected during the rollout.
  // -----------------------------------------------------------------------
  async githubDeviceStart(): Promise<DeviceCodeResponse> {
    return invoke("github_device_start");
  },
  async githubDevicePoll(
    deviceCode: string,
    currentInterval: number,
  ): Promise<DevicePollResponse> {
    return invoke("github_device_poll", { deviceCode, currentInterval });
  },
  async githubCreateRepo(
    name: string,
    description?: string,
  ): Promise<RepoCreateResponse> {
    return invoke("github_create_repo", {
      name,
      description: description ?? null,
    });
  },
  async githubIsLoggedIn(): Promise<boolean> {
    return invoke("github_is_logged_in");
  },
  async githubLogout(): Promise<void> {
    await invoke("github_logout");
  },

  // v0.2.5 — double-click to open a tracked file in the OS default editor.
  // `relPath` must be relative to ~/.claude/ and must not contain ".." or
  // absolute-path components — the Rust layer enforces this. Stable Err
  // strings (see commands.rs::validate_open_path):
  //   "absolute_path_rejected" / "unc_path_rejected"
  //   "path_traversal_rejected" / "file_not_found"
  //   "path_escapes_claude_dir" / "opener_failed: ..."
  async openInEditor(relPath: string): Promise<void> {
    await invoke("open_in_editor", { relPath });
  },
};
