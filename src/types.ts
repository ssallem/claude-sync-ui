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
