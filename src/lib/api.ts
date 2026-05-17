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
};
