// Unit tests for SettingsModal — focuses on the "Change remote" inline form.
// Mocks the Tauri invoke bridge so the modal can call `doctor` on mount and
// `set_remote` on submit without touching the host system.

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { invokeMock, mapResponses } from "../test/invokeMock";
import SettingsModal from "./SettingsModal";
import { LanguageProvider } from "../i18n";
import { ToastProvider } from "./Toast";

// Wrap renders in LanguageProvider (pinned to English) so t() works and assertion
// texts stay stable regardless of host locale. ToastProvider is required because
// SettingsModal calls useToast() for the GitHub-disconnect success/error toast
// since B-3-2 — without it, mounting throws.
function renderModal(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLang="en">
      <ToastProvider>{ui}</ToastProvider>
    </LanguageProvider>,
  );
}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

const okDoctor = {
  overall: "PASS" as const,
  checks: [
    {
      level: "OK" as const,
      name: "remote origin",
      detail: "git@github.com:me/dotclaude.git",
    },
  ],
};

describe("SettingsModal — change remote form", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("expands the inline form when 'Change remote' is clicked", async () => {
    mapResponses({
      doctor: async () => okDoctor,
      github_is_logged_in: async () => false,
    });

    renderModal(
      <SettingsModal
        open={true}
        onClose={() => {}}
        currentRemote="git@github.com:me/old.git"
      />,
    );

    // Wait for doctor() to settle so the modal isn't in its loading state.
    await waitFor(() => {
      expect(screen.getByText(/Overall:/i)).toBeInTheDocument();
    });

    // Form should NOT be present until the button is clicked.
    expect(screen.queryByLabelText(/New remote URL/i)).not.toBeInTheDocument();

    const changeBtn = screen.getByRole("button", { name: /Change remote/i });
    await act(async () => {
      changeBtn.click();
    });

    // Form (input + Update + Cancel) should now be visible.
    expect(screen.getByLabelText(/New remote URL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Update$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeInTheDocument();
  });

  it("invokes set_remote with a valid URL and triggers onRemoteChanged", async () => {
    mapResponses({
      doctor: async () => okDoctor,
      set_remote: async () => null,
      github_is_logged_in: async () => false,
    });

    const onRemoteChanged = vi.fn();
    const onClose = vi.fn();

    renderModal(
      <SettingsModal
        open={true}
        onClose={onClose}
        currentRemote="git@github.com:me/old.git"
        onRemoteChanged={onRemoteChanged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Overall:/i)).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole("button", { name: /Change remote/i }).click();
    });

    const input = screen.getByLabelText(/New remote URL/i) as HTMLInputElement;
    // Seeded with currentRemote — overwrite with a new valid URL.
    fireEvent.change(input, {
      target: { value: "git@github.com:me/new.git" },
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Update$/ }).click();
    });

    await waitFor(() => {
      const setRemoteCalls = invokeMock.mock.calls.filter(
        (c) => c[0] === "set_remote",
      );
      expect(setRemoteCalls.length).toBe(1);
      // Tauri's JS-to-Rust convention is camelCase keys on the JS side.
      expect(setRemoteCalls[0][1]).toEqual({ newUrl: "git@github.com:me/new.git" });
    });

    await waitFor(() => {
      expect(onRemoteChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("rejects an invalid URL inline without calling set_remote", async () => {
    mapResponses({
      doctor: async () => okDoctor,
      set_remote: async () => null,
      github_is_logged_in: async () => false,
    });

    renderModal(
      <SettingsModal
        open={true}
        onClose={() => {}}
        currentRemote="git@github.com:me/old.git"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Overall:/i)).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole("button", { name: /Change remote/i }).click();
    });

    const input = screen.getByLabelText(/New remote URL/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "totally-not-a-url" } });

    // Inline validation message should appear and the Update button must be disabled.
    expect(
      screen.getByText(/Must start with https:\/\/, ssh:\/\/, git@/i),
    ).toBeInTheDocument();
    const updateBtn = screen.getByRole("button", { name: /^Update$/ });
    expect(updateBtn).toBeDisabled();

    // Confirm we never invoked the Tauri command.
    const setRemoteCalls = invokeMock.mock.calls.filter((c) => c[0] === "set_remote");
    expect(setRemoteCalls.length).toBe(0);
  });

  it("surfaces a Tauri error inline and keeps the modal open", async () => {
    mapResponses({
      doctor: async () => okDoctor,
      github_is_logged_in: async () => false,
      set_remote: async () => {
        throw "origin remote not found in git config";
      },
    });

    const onClose = vi.fn();

    renderModal(
      <SettingsModal
        open={true}
        onClose={onClose}
        currentRemote="git@github.com:me/old.git"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Overall:/i)).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole("button", { name: /Change remote/i }).click();
    });

    const input = screen.getByLabelText(/New remote URL/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "git@github.com:me/new.git" },
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Update$/ }).click();
    });

    // Error should show inline, modal stays open (onClose not called).
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/origin remote not found/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
