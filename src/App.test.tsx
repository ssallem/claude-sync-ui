// Integration tests for App — mocks the Tauri invoke bridge end-to-end so the
// real hooks (useStatus / useRemoteUrl) execute their normal effects.
//
// Three scenarios:
//   1. status() rejects with "Not initialized" → InitScreen is shown.
//   2. status() resolves with a clean StatusResult → FileTree + ActionBar render.
//   3. Push button click invokes push then re-invokes status (refresh path).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { invokeMock, mapResponses } from "./test/invokeMock";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { LanguageProvider } from "./i18n";
import type { StatusResult } from "./types";

// Hoisted by Vitest — must reference the singleton from invokeMock.ts.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

function renderApp() {
  // LanguageProvider with initialLang="en" so text-matching assertions stay
  // stable regardless of host locale or persisted localStorage state.
  return render(
    <LanguageProvider initialLang="en">
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>,
  );
}

const okStatus: StatusResult = {
  branch: "main",
  ahead: 1,
  behind: 0,
  tracked: 5,
  changes: [{ path: "agents/foo.md", kind: "M" }],
  excluded_stow: 0,
  excluded_git: 0,
};

const okDoctor = {
  overall: "PASS" as const,
  checks: [
    { level: "OK" as const, name: "remote origin", detail: "https://github.com/me/dotclaude.git" },
  ],
};

describe("App (integration)", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("renders InitScreen when status() rejects with 'Not initialized'", async () => {
    mapResponses({
      status: async () => {
        throw "Not initialized — run `claude-sync init <remote>` first.";
      },
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Welcome to claude-sync/i)).toBeInTheDocument();
    });
    // Init screen exposes a Remote URL input and an Initialize button.
    expect(screen.getByLabelText(/Remote URL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Initialize/i })).toBeInTheDocument();
  });

  // Regression: real sidecar prints "Not initialized." with exit 0; Rust commands.rs
  // now translates that to a rejected promise carrying the original stdout. The
  // exact wording from the binary is "Not initialized. Run `claude-sync init <remote>` first."
  it("renders InitScreen when status() rejects with sidecar exit-0 wording", async () => {
    mapResponses({
      status: async () => {
        throw "Not initialized. Run `claude-sync init <remote>` first.";
      },
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Welcome to claude-sync/i)).toBeInTheDocument();
    });
  });

  // If the repo is wiped externally, git surfaces "fatal: not a git repository"
  // instead of "Not initialized". Route those to InitScreen too — same recovery path.
  it("renders InitScreen when status() rejects with 'not a git repository'", async () => {
    mapResponses({
      status: async () => {
        throw "fatal: not a git repository (or any of the parent directories): .git";
      },
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Welcome to claude-sync/i)).toBeInTheDocument();
    });
  });

  it("renders FileTree + ActionBar when status() resolves with a StatusResult", async () => {
    mapResponses({
      status: async () => okStatus,
      doctor: async () => okDoctor,
    });

    renderApp();

    // FileTree footer with the tracked-files counter.
    await waitFor(() => {
      expect(screen.getByText(/Tracking 5 files/)).toBeInTheDocument();
    });
    // ActionBar Push button with "Push 1↑" label.
    expect(screen.getByRole("button", { name: /Push 1/ })).toBeInTheDocument();
    // The single modified file row.
    expect(screen.getByText("foo.md")).toBeInTheDocument();
  });

  it("clicking Push invokes push() and then re-invokes status() (refresh)", async () => {
    mapResponses({
      status: async () => okStatus,
      doctor: async () => okDoctor,
      push: async () => ({ pushed: 1, commit_sha: "abc1234", message: null, nothing_to_push: false }),
    });

    renderApp();

    const pushBtn = await screen.findByRole("button", { name: /Push 1/ });
    await act(async () => {
      pushBtn.click();
    });

    await waitFor(() => {
      const pushCalls = invokeMock.mock.calls.filter((c) => c[0] === "push");
      const statusCalls = invokeMock.mock.calls.filter((c) => c[0] === "status");
      expect(pushCalls.length).toBe(1);
      // First status call on mount, second from the refresh after push.
      expect(statusCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
