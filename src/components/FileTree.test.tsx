// FileTree integration tests — empty state, grouped state, footer counter.
// Uses a real StatusBadge child render so the badge label assertions also
// confirm the M/A/?/! kinds get through the parent intact.

import React from "react";
import { describe, it, expect } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import FileTree from "./FileTree";
import type { ChangeEntry } from "../types";
import { LanguageProvider } from "../i18n";

// Wrap renders so FileTree's useTranslation hook has a provider; pin to English
// for stable text assertions.
const render = (ui: React.ReactElement) =>
  rtlRender(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);

describe("FileTree", () => {
  it("shows the 'No changes — clean' empty state and a tracking footer when changes are empty", () => {
    render(<FileTree changes={[]} tracked={42} excluded_stow={3} excluded_git={1} />);
    // NB: source uses an em-dash ("—") between "changes" and "clean".
    expect(screen.getByText(/No changes/i)).toBeInTheDocument();
    expect(screen.getByText(/clean/i)).toBeInTheDocument();
    expect(screen.getByText(/Tracking 42 files/)).toBeInTheDocument();
    expect(screen.getByText(/excluded: 3 stow, 1 git/)).toBeInTheDocument();
  });

  it("groups changes by leading directory, places root files in '(root)', and renders kind badges", () => {
    const changes: ChangeEntry[] = [
      { path: "agents/foo.md", kind: "M" },
      { path: "commands/bar.md", kind: "A" },
      { path: "CLAUDE.md", kind: "?" },
    ];
    render(<FileTree changes={changes} tracked={3} excluded_stow={0} excluded_git={0} />);

    // Directory group headers — agents/, commands/, (root).
    expect(screen.getByText("agents/")).toBeInTheDocument();
    expect(screen.getByText("commands/")).toBeInTheDocument();
    expect(screen.getByText("(root)")).toBeInTheDocument();

    // Files (stripped of the leading directory).
    expect(screen.getByText("foo.md")).toBeInTheDocument();
    expect(screen.getByText("bar.md")).toBeInTheDocument();
    expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();

    // Each badge letter is present exactly once.
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("uses singular 'file' when exactly one file is tracked", () => {
    render(<FileTree changes={[]} tracked={1} excluded_stow={0} excluded_git={0} />);
    expect(screen.getByText(/Tracking 1 file\b/)).toBeInTheDocument();
  });
});
