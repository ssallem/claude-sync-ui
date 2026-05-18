// Unit tests for the InitScreen stepper (B-3-2).
//
// We exercise three transitions:
//   1. 'choose' renders both the OAuth button and the manual remote form.
//   2. Clicking "Sign in with GitHub" advances to 'oauth-auth', mounting
//      GitHubAuthFlow which fires its device_start invoke.
//   3. A successful poll inside GitHubAuthFlow advances to 'oauth-repo';
//      from there, a successful repo create routes the clone_url back
//      into onSubmit (the same path used by manual URL entry).
//
// GitHubAuthFlow uses fake timers internally for its poll loop, so we
// configure vi.useFakeTimers({ shouldAdvanceTime: true }) for the OAuth
// scenarios — that lets awaited invoke promises tick forward without
// us having to drive every microtask manually.

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { invokeMock, mapResponses } from "../test/invokeMock";
import InitScreen from "./InitScreen";
import { LanguageProvider } from "../i18n";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

// GitHubAuthFlow dynamically imports the opener plugin — stub it so jsdom
// doesn't blow up trying to load the real Tauri plugin.
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => undefined),
}));

function renderInit(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);
}

const baseDeviceCode = {
  device_code: "DEVCODE-XYZ",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
};

describe("InitScreen — stepper", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("renders both OAuth and manual entry on initial 'choose' step", () => {
    renderInit(<InitScreen onSubmit={async () => {}} loading={false} error={null} />);

    // OAuth shortcut button (uses the new i18n key).
    expect(
      screen.getByRole("button", { name: /Sign in with GitHub/i }),
    ).toBeInTheDocument();
    // Manual form input + initialize button.
    expect(screen.getByLabelText(/Remote URL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Initialize$/i })).toBeInTheDocument();
  });

  it("transitions to oauth-auth and mounts GitHubAuthFlow on button click", async () => {
    mapResponses({
      // Resolve device_start so GitHubAuthFlow reaches its awaiting-user state
      // (and we can assert on the rendered user_code).
      github_device_start: async () => baseDeviceCode,
      github_device_poll: async () => ({ status: "pending", new_interval: null }),
    });

    // Fake timers needed because GitHubAuthFlow schedules a setTimeout poll
    // chain. shouldAdvanceTime keeps the awaited startFlow() ticking.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderInit(<InitScreen onSubmit={async () => {}} loading={false} error={null} />);

      await act(async () => {
        screen.getByRole("button", { name: /Sign in with GitHub/i }).click();
      });

      // user_code is the most reliable proof that GitHubAuthFlow mounted and
      // device_start resolved. Manual form should be gone in this step.
      await waitFor(() => {
        expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
      });
      expect(screen.queryByLabelText(/Remote URL/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes RepoCreator.onCreated → onSubmit(cloneUrl)", async () => {
    // We drive the OAuth path end-to-end by simulating a 'success' on the
    // first poll — that advances the stepper to 'oauth-repo' without us
    // having to wait the real poll interval.
    mapResponses({
      github_device_start: async () => baseDeviceCode,
      github_device_poll: async () => ({ status: "success", new_interval: null }),
      github_create_repo: async () => ({
        clone_url: "https://github.com/me/dotclaude.git",
        ssh_url: "git@github.com:me/dotclaude.git",
        full_name: "me/dotclaude",
      }),
    });

    const onSubmit = vi.fn(async () => {});

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderInit(<InitScreen onSubmit={onSubmit} loading={false} error={null} />);

      // Step 1: click OAuth shortcut.
      await act(async () => {
        screen.getByRole("button", { name: /Sign in with GitHub/i }).click();
      });

      // Advance fake timers past the first poll interval so the poll fires
      // and resolves to "success". GitHubAuthFlow will then call its
      // onSuccess() → InitScreen transitions to 'oauth-repo'.
      await act(async () => {
        await vi.advanceTimersByTimeAsync((baseDeviceCode.interval + 1) * 1000);
      });

      // Step 3: RepoCreator should be visible.
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Create private repository/i }),
        ).toBeInTheDocument();
      });

      // Hit Create — default name is "dotclaude", which is valid.
      await act(async () => {
        screen.getByRole("button", { name: /Create private repository/i }).click();
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith("https://github.com/me/dotclaude.git");
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("InitScreen — manual remote path (regression)", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  // Existing App.test.tsx already covers init via the manual flow at a higher
  // level; this is a focused regression: typing a URL + clicking Initialize
  // still calls onSubmit with the trimmed value after the refactor.
  afterEach(() => {
    // Defensive — every previous test should restore real timers, but if one
    // throws mid-flight we don't want leaked fake timers to poison the next
    // suite. vi.useRealTimers is a no-op if already real.
    vi.useRealTimers();
  });

  it("submits the trimmed remote on the manual form", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const onSubmit = vi.fn(async () => {});
    renderInit(<InitScreen onSubmit={onSubmit} loading={false} error={null} />);

    const input = screen.getByLabelText(/Remote URL/i) as HTMLInputElement;
    // Single fireEvent.change is enough — it flushes through React's
    // controlled-input pathway and toggles the Initialize button's disabled
    // state synchronously inside the test's tick.
    fireEvent.change(input, {
      target: { value: "  https://github.com/me/dotclaude.git  " },
    });

    const submitBtn = screen.getByRole("button", { name: /^Initialize$/i });
    expect(submitBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.submit(submitBtn.closest("form")!);
    });

    expect(onSubmit).toHaveBeenCalledWith("https://github.com/me/dotclaude.git");
  });
});
