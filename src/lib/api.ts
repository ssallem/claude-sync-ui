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

  // v0.2.3 hotfix — write a recommended `~/.claude/.stowignore` when the
  // sidecar's secret-scan blocks first-run init. Stable Err strings the
  // ErrorBanner can pattern-match for user-facing messaging:
  //   - "stowignore_exists"     → file already present, do not overwrite
  //   - "claude_dir_not_found"  → ~/.claude/ missing on disk
  // Any other Err is a write failure that's surfaced verbatim.
  async createDefaultStowignore(): Promise<void> {
    await invoke("create_default_stowignore");
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
};
