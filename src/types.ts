// Mirrors src-tauri/src/commands.rs serde output.
// Rust structs use snake_case fields and serde's default serializer keeps them as-is,
// so TS interfaces match snake_case verbatim. No #[serde(rename_all)] needed on the Rust side.

export type ChangeKind = "M" | "A" | "D" | "?" | "!";

export interface ChangeEntry {
  path: string;
  kind: ChangeKind | string; // string fallback in case the sidecar emits a new code
}

export interface StatusResult {
  branch: string;
  ahead: number;
  behind: number;
  tracked: number;
  changes: ChangeEntry[]; // empty array when clean
  excluded_stow: number;
  excluded_git: number;
}

export interface PushResult {
  pushed: number;
  commit_sha: string | null;
  message: string | null;
  nothing_to_push: boolean;
}

export type PullKind = "initialized" | "fast_forward" | "auto_merge" | "conflict";

export interface PullResult {
  kind: PullKind;
  files: number;
  commit_sha: string | null;
  conflict_files: number;
}

export type DoctorLevel = "OK" | "WARN" | "FAIL";
export type DoctorOverall = "PASS" | "WARN" | "FAIL";

export interface DoctorCheck {
  level: DoctorLevel;
  name: string;
  detail: string;
}

export interface DoctorResult {
  overall: DoctorOverall;
  checks: DoctorCheck[];
}

// ----------------------------------------------------------------------------
// GitHub OAuth Device Flow (mirrors src-tauri/src/commands.rs B-2-1/B-2-2).
//
// Why three types? The Device Flow is a two-step dance: the backend asks GitHub
// for a user_code (DeviceCodeResponse), the UI shows it, and the backend polls
// until GitHub returns success/expired/denied (DevicePollResponse). Once auth
// completes, a separate command creates the private repo (RepoCreateResponse).
// All access tokens stay in the OS keyring on the Rust side — the frontend
// never sees them.
// ----------------------------------------------------------------------------

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type DevicePollStatus =
  | "pending"
  | "success"
  | "slow_down"
  | "expired"
  | "denied";

export interface DevicePollResponse {
  status: DevicePollStatus;
  // Only populated when status === "slow_down" — GitHub asked us to back off.
  new_interval: number | null;
}

export interface RepoCreateResponse {
  clone_url: string;
  ssh_url: string;
  full_name: string;
}

// v0.2.10 — return type for create_smart_stowignore. `action` indicates
// whether the file was newly created, an existing file got missing entries
// appended, or no change was needed (all detected paths already covered).
export interface StowignoreResult {
  action: "created" | "appended" | "no_change";
  entries_written: number;
}
