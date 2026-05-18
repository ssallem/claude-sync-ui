// Mock entry used ONLY by Playwright screenshot capture and manual dev visual testing.
// Stubs `window.__TAURI_INTERNALS__` so `@tauri-apps/api/core`'s `invoke()` resolves to
// canned responses instead of trying to reach a real Tauri runtime. The scenario is picked
// from `?scenario=init|main|conflict` on the URL.
//
// IMPORTANT: this file is NOT bundled into the Tauri release; only `src/main.tsx` is.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider, useToast } from "./components/Toast";
import { LanguageProvider } from "./i18n";
import "./index.css";
import type {
  StatusResult,
  DoctorResult,
  PushResult,
  PullResult,
} from "./types";

type Scenario = "init" | "main" | "conflict";

function pickScenario(): Scenario {
  const param = new URLSearchParams(window.location.search).get("scenario");
  if (param === "init" || param === "main" || param === "conflict") return param;
  return "main";
}

const SCENARIO: Scenario = pickScenario();

const MAIN_STATUS: StatusResult = {
  branch: "main",
  ahead: 2,
  behind: 1,
  tracked: 47,
  excluded_stow: 3,
  excluded_git: 5,
  changes: [
    { path: "settings.json", kind: "M" },
    { path: "agents/new-agent.md", kind: "A" },
    { path: "agents/reviewer.md", kind: "M" },
    { path: "hooks/draft.md", kind: "?" },
  ],
};

const CONFLICT_STATUS: StatusResult = {
  ...MAIN_STATUS,
  changes: [
    ...MAIN_STATUS.changes,
    { path: "rules/golden-principles.md", kind: "!" },
  ],
};

const DOCTOR_OK: DoctorResult = {
  overall: "PASS",
  checks: [
    { level: "OK", name: "git binary", detail: "git version 2.43.0" },
    { level: "OK", name: "git identity", detail: "user.name + user.email set" },
    {
      level: "OK",
      name: "remote origin",
      detail: "git@github.com:you/dotclaude.git",
    },
    { level: "OK", name: "ignore files", detail: ".gitignore + .stow-local-ignore present" },
    { level: "OK", name: "recognized subfolders", detail: "agents, commands, hooks, rules, skills" },
    { level: "OK", name: "secret scanner", detail: "no matches in tracked files" },
  ],
};

const PUSH_OK: PushResult = {
  pushed: 2,
  commit_sha: "abc1234",
  message: "sync",
  nothing_to_push: false,
};

const PULL_OK: PullResult = {
  kind: "fast_forward",
  files: 1,
  commit_sha: "def5678",
  conflict_files: 0,
};

function mockInvoke(cmd: string, _args?: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case "status": {
      if (SCENARIO === "init") {
        return Promise.reject("Not initialized: ~/.claude is not a git repo. Run `claude-sync init <remote>` first.");
      }
      return Promise.resolve(SCENARIO === "conflict" ? CONFLICT_STATUS : MAIN_STATUS);
    }
    case "doctor":
      return Promise.resolve(DOCTOR_OK);
    case "push":
      return Promise.resolve(PUSH_OK);
    case "pull":
      return Promise.resolve(PULL_OK);
    case "init":
      return Promise.resolve("Initialized");
    default:
      return Promise.reject(`mock: unknown command "${cmd}"`);
  }
}

// Minimal shim — only the `invoke` field is read by `@tauri-apps/api/core`.
(window as unknown as { __TAURI_INTERNALS__: { invoke: typeof mockInvoke } }).__TAURI_INTERNALS__ = {
  invoke: mockInvoke,
};

// Conflict scenario: after the app mounts, surface the conflict toast so it shows up
// in the screenshot without needing a real button click in Playwright.
function ConflictToastTrigger() {
  const toast = useToast();
  React.useEffect(() => {
    if (SCENARIO !== "conflict") return;
    const t = window.setTimeout(() => {
      toast.error(
        "Conflict resolver coming in v0.2 — for now, edit ~/.claude/<file> manually and remove the '_conflicts' key, then push.",
      );
    }, 400);
    return () => window.clearTimeout(t);
  }, [toast]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <ConflictToastTrigger />
        <App />
      </ToastProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
