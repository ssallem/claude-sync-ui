// Unit tests for GitHubAuthFlow — covers the three observable transitions:
//   1. mount → starting → awaiting-user (renders user_code).
//   2. polling → success → onSuccess() callback fires.
//   3. polling → expired → error message + try-again button visible.
//
// We control time with fake timers so the recursive setTimeout-based poll
// loop is deterministic: advancing the clock by `interval * 1000` ms triggers
// exactly one poll call. The Tauri `invoke` bridge is mocked, as is the
// tauri-plugin-opener module (the component awaits a dynamic import of it).

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { invokeMock, mapResponses } from "./invokeMock";
import GitHubAuthFlow from "../components/GitHubAuthFlow";
import { LanguageProvider } from "../i18n";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

// Stub the dynamically-imported opener plugin — the component calls openUrl
// fire-and-forget, so the resolved Promise is enough; we just need the import
// not to fail under jsdom.
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => undefined),
}));

const baseDeviceCode = {
  device_code: "DEVCODE-XYZ",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
};

function renderFlow(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);
}

// Helper: flushes all pending Promise microtasks. Calling Promise.resolve()
// once is enough for one `await` boundary, but the poll loop chains several
// (await invoke → setState → schedule next setTimeout) so we tick multiple
// times to settle the whole chain inside a single act().
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe("GitHubAuthFlow", () => {
  beforeEach(() => {
    invokeMock.mockClear();
    // Use fake timers from the very start so the setTimeout/setInterval
    // schedules created inside startFlow() land on the fake timeline. Using
    // shouldAdvanceTime keeps awaited Promise microtasks ticking forward
    // automatically — without it, an `await api.githubDeviceStart()` would
    // hang because the test never yields to the next macrotask.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transitions from 'starting' to 'awaiting-user' and renders the user_code", async () => {
    mapResponses({
      github_device_start: async () => baseDeviceCode,
      github_device_poll: async () => ({ status: "pending", new_interval: null }),
    });

    renderFlow(<GitHubAuthFlow onSuccess={() => {}} onCancel={() => {}} />);

    // user_code shows up once device_start resolves. waitFor under
    // shouldAdvanceTime cooperates with fake timers, so this still polls.
    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Copy code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open in browser/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /github\.com\/login\/device/i }),
    ).toBeInTheDocument();

    const startCalls = invokeMock.mock.calls.filter(
      (c) => c[0] === "github_device_start",
    );
    expect(startCalls.length).toBe(1);
  });

  it("invokes onSuccess when polling resolves with 'success'", async () => {
    let pollCount = 0;
    mapResponses({
      github_device_start: async () => baseDeviceCode,
      github_device_poll: async () => {
        pollCount += 1;
        // First poll = pending, second = success — proves the recursive
        // setTimeout re-schedules itself after a non-terminal status.
        if (pollCount === 1) return { status: "pending", new_interval: null };
        return { status: "success", new_interval: null };
      },
    });

    const onSuccess = vi.fn();
    renderFlow(<GitHubAuthFlow onSuccess={onSuccess} onCancel={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    });

    // Drive the poll loop. Interval is 5s; we advance by 5s and flush
    // microtasks so the awaited invoke resolves and schedules the next
    // setTimeout. Two iterations: pending poll, then success poll.
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });

    expect(pollCount).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not call onSuccess when an inflight poll resolves after countdown expiry", async () => {
    // Regression for race condition: the 1Hz countdown can hit zero while a
    // `github_device_poll` invoke is already inflight. If that pending invoke
    // then resolves with `success`, the old code would still fire onSuccess()
    // — pushing the parent flow forward against an expired session. The fix
    // sets `cancelledRef = true` inside the expiry branch so the resolved
    // poll silently drops its result.
    //
    // We model the race by:
    //   1. starting with expires_in = 1s so the countdown can reach 0 quickly.
    //   2. making `github_device_poll` return a Promise we resolve *manually*
    //      after expiry — simulating a slow network call that lands late.
    let resolvePoll: ((value: { status: string; new_interval: number | null }) => void) | null = null;
    const pollPromise = new Promise<{ status: string; new_interval: number | null }>((res) => {
      resolvePoll = res;
    });

    mapResponses({
      github_device_start: async () => ({ ...baseDeviceCode, expires_in: 1, interval: 1 }),
      github_device_poll: () => pollPromise,
    });

    const onSuccess = vi.fn();
    renderFlow(<GitHubAuthFlow onSuccess={onSuccess} onCancel={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    });

    // Schedule the first poll (interval = 1s) — the poll is now inflight,
    // hanging on `pollPromise`. Then advance the clock past expires_in so the
    // countdown trips zero and the component transitions to "error".
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000); // > expires_in
      await flushMicrotasks();
    });

    // Confirm we hit the expired error state before resolving the inflight poll.
    expect(
      screen.getByText(/The code expired\. Please try again\./i),
    ).toBeInTheDocument();

    // Now resolve the inflight poll with `success` — this is the racy result
    // that must NOT call onSuccess().
    await act(async () => {
      resolvePoll!({ status: "success", new_interval: null });
      await flushMicrotasks();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    // Still in expired state — late success didn't flip the phase.
    expect(
      screen.getByText(/The code expired\. Please try again\./i),
    ).toBeInTheDocument();
  });

  it("shows the expired error and a Try again button when poll returns 'expired'", async () => {
    mapResponses({
      github_device_start: async () => baseDeviceCode,
      github_device_poll: async () => ({ status: "expired", new_interval: null }),
    });

    renderFlow(<GitHubAuthFlow onSuccess={() => {}} onCancel={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("ABCD-1234")).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000); // first poll → 'expired'
      await flushMicrotasks();
    });

    expect(
      screen.getByText(/The code expired\. Please try again\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try again/i }),
    ).toBeInTheDocument();
    // user_code is gone — we left the awaiting-user phase.
    expect(screen.queryByText("ABCD-1234")).not.toBeInTheDocument();
  });
});
