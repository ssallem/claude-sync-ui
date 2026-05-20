// StowignoreModal — v0.2.4 inspector that shows ~/.claude/.stowignore so
// users can self-verify per-machine exclusions (projects/, file-history/,
// daemon/, etc.). Tests cover the three render branches and refetch on
// open + Escape-to-close behaviour.

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { invokeMock, mapResponses } from "../test/invokeMock";
import StowignoreModal from "./StowignoreModal";
import { LanguageProvider } from "../i18n";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

const render = (ui: React.ReactElement) =>
  rtlRender(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);

describe("StowignoreModal", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("renders nothing when closed", () => {
    mapResponses({ read_stowignore: async () => "" });
    render(<StowignoreModal open={false} onClose={() => {}} />);
    // No dialog, and no fetch attempt while closed.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      invokeMock.mock.calls.filter((c) => c[0] === "read_stowignore"),
    ).toHaveLength(0);
  });

  it("renders the .stowignore body when the command resolves with content", async () => {
    const body = "# header\n.credentials.json\nfile-history/\nprojects/\nunique-test-marker-x7q\n";
    mapResponses({ read_stowignore: async () => body });
    render(<StowignoreModal open={true} onClose={() => {}} />);

    // Use a string that cannot appear in the static modal description so the
    // assertion targets the rendered file body specifically.
    await waitFor(() => {
      expect(screen.getByText(/unique-test-marker-x7q/)).toBeInTheDocument();
    });
    // The body is a single <pre> block; assert the whole text content of the
    // <pre> rather than re-matching substrings that also appear in the modal
    // description ("projects/", "file-history/").
    const pre = screen.getByText(/unique-test-marker-x7q/);
    expect(pre.textContent).toContain(".credentials.json");
    expect(pre.textContent).toContain("file-history/");
    expect(pre.textContent).toContain("projects/");
  });

  it("renders the empty-state message when the file is missing (body === '')", async () => {
    mapResponses({ read_stowignore: async () => "" });
    render(<StowignoreModal open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No .stowignore file/i),
      ).toBeInTheDocument();
    });
  });

  it("surfaces an error when read_stowignore rejects", async () => {
    mapResponses({
      read_stowignore: async () => {
        throw "read C:\\Users\\me\\.claude\\.stowignore: permission denied";
      },
    });
    render(<StowignoreModal open={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied/)).toBeInTheDocument();
    });
  });

  it("closes when Escape is pressed", async () => {
    mapResponses({ read_stowignore: async () => "" });
    const onClose = vi.fn();
    render(<StowignoreModal open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the close button is clicked", async () => {
    mapResponses({ read_stowignore: async () => "" });
    const onClose = vi.fn();
    render(<StowignoreModal open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
