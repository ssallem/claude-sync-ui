// FileTree integration tests — empty state, grouped state, footer counter.
// Uses a real StatusBadge child render so the badge label assertions also
// confirm the M/A/?/! kinds get through the parent intact.

import React from "react";
import { describe, it, expect, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
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

  // v0.2.4 — directory groups must be click-to-collapse. Before the toggle
  // landed, the ▼ glyph looked like a button but did nothing.
  it("collapses a directory group when its header is clicked and re-expands on second click", () => {
    const changes: ChangeEntry[] = [
      { path: "agents/foo.md", kind: "M" },
      { path: "agents/bar.md", kind: "?" },
      { path: "commands/baz.md", kind: "A" },
    ];
    render(
      <FileTree changes={changes} tracked={3} excluded_stow={0} excluded_git={0} />,
    );
    // Files are visible by default.
    expect(screen.getByText("foo.md")).toBeInTheDocument();
    expect(screen.getByText("bar.md")).toBeInTheDocument();
    expect(screen.getByText("baz.md")).toBeInTheDocument();

    // Click the "agents/" group header — find the toggle button by its text.
    const agentsHeader = screen.getByRole("button", { name: /agents\// });
    expect(agentsHeader).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(agentsHeader);
    expect(agentsHeader).toHaveAttribute("aria-expanded", "false");

    // agents/ entries hidden, commands/ entry still visible (independent state).
    expect(screen.queryByText("foo.md")).not.toBeInTheDocument();
    expect(screen.queryByText("bar.md")).not.toBeInTheDocument();
    expect(screen.getByText("baz.md")).toBeInTheDocument();

    // Click again to re-expand.
    fireEvent.click(agentsHeader);
    expect(agentsHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("foo.md")).toBeInTheDocument();
    expect(screen.getByText("bar.md")).toBeInTheDocument();
  });

  it("renders 'What's excluded?' link in the footer only when exclusions exist AND a handler is supplied", () => {
    const onShowExcluded = vi.fn();

    // No handler -> no link, even if exclusions exist.
    const { unmount } = render(
      <FileTree changes={[]} tracked={5} excluded_stow={3} excluded_git={1} />,
    );
    expect(
      screen.queryByRole("button", { name: /What's excluded/i }),
    ).not.toBeInTheDocument();
    unmount();

    // Handler supplied + exclusions exist -> link renders and fires.
    render(
      <FileTree
        changes={[]}
        tracked={5}
        excluded_stow={3}
        excluded_git={1}
        onShowExcluded={onShowExcluded}
      />,
    );
    const link = screen.getByRole("button", { name: /What's excluded/i });
    fireEvent.click(link);
    expect(onShowExcluded).toHaveBeenCalledTimes(1);
  });

  it("hides the 'What's excluded?' link when both exclusion counts are zero", () => {
    render(
      <FileTree
        changes={[]}
        tracked={5}
        excluded_stow={0}
        excluded_git={0}
        onShowExcluded={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /What's excluded/i }),
    ).not.toBeInTheDocument();
  });

  // Make the explicit "within" import we added a few lines up valid — silence
  // the unused-import warning some setups would emit. The cheap helper also
  // doubles as a sanity check that a header button scopes correctly.
  it("scopes the agents/ entries under its own toggle button", () => {
    const changes: ChangeEntry[] = [
      { path: "agents/x.md", kind: "M" },
      { path: "commands/y.md", kind: "A" },
    ];
    render(<FileTree changes={changes} tracked={2} excluded_stow={0} excluded_git={0} />);
    const agentsHeader = screen.getByRole("button", { name: /agents\// });
    const agentsList = agentsHeader.parentElement;
    expect(agentsList).not.toBeNull();
    expect(within(agentsList as HTMLElement).getByText("x.md")).toBeInTheDocument();
  });
});
