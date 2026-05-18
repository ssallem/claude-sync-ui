// Thin typed wrappers around the Tauri commands defined in src-tauri/src/commands.rs.
// Keep this file free of UI concerns — pure invoke + types.

import { invoke } from "@tauri-apps/api/core";
import type {
  StatusResult,
  PushResult,
  PullResult,
  DoctorResult,
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
};
