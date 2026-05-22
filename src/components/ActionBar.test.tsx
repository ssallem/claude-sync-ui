// ActionBar regression tests — v0.2.4 hotfix.
// The bug: push button disabled whenever ahead === 0, trapping users on an
// unborn branch (post-init, no commits yet) and users with uncommitted local
// changes (claude-sync push stages+commits+pushes in one step).

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import ActionBar from "./ActionBar";
import type { StatusResult } from "../types";
import { LanguageProvider } from "../i18n";

const render = (ui: React.ReactElement) =>
  rtlRender(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);

const buildStatus = (overrides: Partial<StatusResult> = {}): StatusResult => ({
  branch: "main",
  ahead: 0,
  behind: 0,
  tracked: 0,
  changes: [],
  excluded_stow: 0,
  excluded_git: 0,
  ...overrides,
});

const noop = () => {};

describe("ActionBar — push enablement", () => {
  it("disables push when in-sync and no local changes", () => {
    render(
      <ActionBar
        status={buildStatus()}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 0/ });
    expect(push).toBeDisabled();
  });

  it("enables push when ahead > 0 (existing commits to push)", () => {
    render(
      <ActionBar
        status={buildStatus({ ahead: 3 })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 3/ });
    expect(push).toBeEnabled();
  });

  // The dogfood bug: branch unborn after `claude-sync init`, ahead=0, but
  // local changes exist. Before the v0.2.4 fix this button was disabled and
  // there was no way to trigger the initial sync from the UI.
  it("enables push on unborn-branch state (ahead=0, untracked files present)", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 0,
          changes: [
            { path: "CLAUDE.md", kind: "?" },
            { path: "settings.json", kind: "?" },
            { path: "agents/foo.md", kind: "?" },
          ],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    // 0 ahead + 1 pending commit (from the staged changes) = 1.
    const push = screen.getByRole("button", { name: /Push 1/ });
    expect(push).toBeEnabled();
  });

  // The broader bug fixed at the same time: any working-tree edit with no
  // pending commit was also unpushable.
  it("enables push when there are modified files but no commits ahead", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 0,
          changes: [{ path: "settings.json", kind: "M" }],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 1/ });
    expect(push).toBeEnabled();
  });

  // Conflict-kind entries must not enable push — pushing with an unresolved
  // conflict is wrong; Resolve Conflicts handles them.
  it("does NOT enable push when only conflict entries are present", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 0,
          changes: [{ path: "agents/x.md", kind: "!" }],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 0/ });
    expect(push).toBeDisabled();
  });

  // Hard safety gate: a working tree with both a clean modification and an
  // unresolved conflict must NOT allow push. The previous rule would have
  // enabled push because pendingChanges > 0, but pushing a half-merged state
  // breaks peers on next pull.
  it("disables push when any conflict entry coexists with normal changes", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 0,
          changes: [
            { path: "settings.json", kind: "M" },
            { path: "agents/foo.md", kind: "!" },
          ],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 1/ });
    expect(push).toBeDisabled();
  });

  it("disables push when ahead > 0 but a conflict is present", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 2,
          changes: [{ path: "x.md", kind: "!" }],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const push = screen.getByRole("button", { name: /Push 2/ });
    expect(push).toBeDisabled();
  });

  it("shows ahead + 1 when both prior commits and new changes coexist", () => {
    render(
      <ActionBar
        status={buildStatus({
          ahead: 2,
          changes: [{ path: "settings.json", kind: "M" }],
        })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    // 2 ahead + 1 new commit = 3.
    const push = screen.getByRole("button", { name: /Push 3/ });
    expect(push).toBeEnabled();
  });

  // v0.2.13 — friend-PC dogfood: branch `(unborn)` after `init` against a
  // populated remote. ahead=0, behind=0 (no upstream comparison yet), but
  // there are commits on origin the new PC needs. Before the fix, the Pull
  // button was disabled because `behind === 0`, leaving no in-app recovery.
  it("enables Pull when branch is (unborn), even with behind=0", () => {
    render(
      <ActionBar
        status={buildStatus({ branch: "(unborn)", ahead: 0, behind: 0 })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    const pull = screen.getByRole("button", { name: /Initialize from remote/ });
    expect(pull).toBeEnabled();
  });

  it("invokes onPull when clicked in (unborn) state", () => {
    const onPull = vi.fn();
    render(
      <ActionBar
        status={buildStatus({ branch: "(unborn)", ahead: 0, behind: 0 })}
        onPush={noop}
        onPull={onPull}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Initialize from remote/ }));
    expect(onPull).toHaveBeenCalledTimes(1);
  });

  it("disables Pull when (unborn) and loading=pull", () => {
    render(
      <ActionBar
        status={buildStatus({ branch: "(unborn)", ahead: 0, behind: 0 })}
        onPush={noop}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading="pull"
      />,
    );
    const pull = screen.getByRole("button", { name: /Initialize from remote/ });
    expect(pull).toBeDisabled();
  });

  it("invokes onPush on click", async () => {
    const onPush = vi.fn();
    render(
      <ActionBar
        status={buildStatus({
          ahead: 0,
          changes: [{ path: "settings.json", kind: "?" }],
        })}
        onPush={onPush}
        onPull={noop}
        onResolve={noop}
        onRefresh={noop}
        loading={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Push 1/ }));
    expect(onPush).toHaveBeenCalledTimes(1);
  });
});
