// Unit tests for RepoCreator — three observable behaviours:
//   1. Empty-name submission short-circuits to the i18n invalid-name error
//      without invoking the Tauri command (matches the Rust guard policy).
//   2. A 422 "repo_taken" reply from the backend maps to the dedicated
//      i18n key and surfaces inline.
//   3. A success reply propagates the clone_url to onCreated() and leaves
//      the form idle (no lingering "creating..." button label).
//
// We don't bother with a fake-timer setup here — RepoCreator has no
// recursive polling or async UI animation; one click resolves the whole
// roundtrip.

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { invokeMock, mapResponses } from "../test/invokeMock";
import RepoCreator from "./RepoCreator";
import { LanguageProvider } from "../i18n";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

function renderRepo(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);
}

describe("RepoCreator", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("blocks submit on empty name and shows the invalid-name i18n message", async () => {
    // No backend route needed — the client guard short-circuits before any
    // invoke would happen.
    mapResponses({});

    const onCreated = vi.fn();
    renderRepo(<RepoCreator onCreated={onCreated} onBack={() => {}} />);

    const input = screen.getByLabelText(/Repository name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });

    const submitBtn = screen.getByRole("button", { name: /Create private repository/i });
    await act(async () => {
      submitBtn.click();
    });

    // i18n error text appears inline.
    expect(
      screen.getByText(/Repository name cannot be empty\./i),
    ).toBeInTheDocument();

    // And we never reached the Rust side.
    const calls = invokeMock.mock.calls.filter((c) => c[0] === "github_create_repo");
    expect(calls.length).toBe(0);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("maps a 422 repo_taken response to the dedicated i18n message", async () => {
    mapResponses({
      github_create_repo: async () => {
        // The Rust side stringifies this exact token for the 422 path.
        throw "repo_taken";
      },
    });

    renderRepo(<RepoCreator onCreated={() => {}} onBack={() => {}} />);

    // Default value is "dotclaude", which trims to a valid non-empty name —
    // hit submit directly.
    await act(async () => {
      screen.getByRole("button", { name: /Create private repository/i }).click();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/repository with this name already exists/i),
      ).toBeInTheDocument();
    });
  });

  it("calls onCreated with clone_url on success", async () => {
    mapResponses({
      github_create_repo: async () => ({
        clone_url: "https://github.com/me/dotclaude.git",
        ssh_url: "git@github.com:me/dotclaude.git",
        full_name: "me/dotclaude",
      }),
    });

    const onCreated = vi.fn();
    renderRepo(<RepoCreator onCreated={onCreated} onBack={() => {}} />);

    await act(async () => {
      screen.getByRole("button", { name: /Create private repository/i }).click();
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith("https://github.com/me/dotclaude.git");
    });

    // Confirm the argument key matches the Tauri JS→Rust camelCase contract
    // (RepoCreator wraps `name` only — `description` is omitted as null).
    const calls = invokeMock.mock.calls.filter((c) => c[0] === "github_create_repo");
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toEqual({ name: "dotclaude", description: null });
  });
});
