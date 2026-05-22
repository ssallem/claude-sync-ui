// Bottom action row: Push / Pull / Resolve / Refresh.
// Counts derive from StatusResult; zero-count buttons render disabled.

import { useMemo } from "react";
import type { StatusResult } from "../types";
import { useTranslation } from "../i18n";

export type ActionKey = "push" | "pull" | "resolve" | "refresh";

interface ActionBarProps {
  status: StatusResult | null;
  onPush: () => void;
  onPull: () => void;
  onResolve: () => void;
  onRefresh: () => void;
  loading: ActionKey | null;
}

interface ActionButtonProps {
  label: string;
  variant: "primary" | "secondary" | "danger" | "ghost";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

function ActionButton({ label, variant, disabled, loading, onClick }: ActionButtonProps) {
  const variants: Record<ActionButtonProps["variant"], string> = {
    primary: "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-100",
    danger: "bg-red-600 hover:bg-red-500 active:bg-red-700 text-white",
    ghost: "bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200",
  };
  const base = "px-3 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1";
  const off = disabled ? " opacity-50 cursor-not-allowed pointer-events-none" : "";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]}${off}`}>
      <span>{label}</span>
      {loading && <span className="animate-pulse">...</span>}
    </button>
  );
}

export default function ActionBar({ status, onPush, onPull, onResolve, onRefresh, loading }: ActionBarProps) {
  const { t } = useTranslation();
  const ahead = status?.ahead ?? 0;
  const behind = status?.behind ?? 0;
  // v0.2.13 — friend-PC dogfood: after `init` against a populated remote the
  // local branch is `(unborn)` with ahead=0/behind=0, so the old `behind === 0`
  // gate left the Pull button disabled even though origin had commits the new
  // PC needed. sidecar `pull.rs` already handles the unborn case
  // (fetch + adopt FETCH_HEAD as the initial commit) — we just had to let the
  // UI fire it.
  const isUnborn = status?.branch === "(unborn)";
  const conflicts = useMemo(
    () => (status?.changes ?? []).filter((c) => c.kind === "!").length,
    [status],
  );
  // v0.2.4 fix: enable push when uncommitted local changes exist, even if
  // ahead === 0. The previous logic disabled push whenever ahead === 0, which
  // trapped users in two real-world states:
  //   1. Unborn branch right after init — no commits yet, but 1000+ untracked
  //      files waiting to become the initial sync. (Dogfood report.)
  //   2. Plain working-tree edits before any local commit — `claude-sync push`
  //      stages+commits+pushes in one step, so there's always something to do
  //      when changes.length > 0.
  // Conflict-kind entries are excluded because pushing with unresolved
  // conflicts is wrong — the dedicated Resolve button handles those.
  const pendingChanges = useMemo(
    () => (status?.changes ?? []).filter((c) => c.kind !== "!").length,
    [status],
  );
  // Count semantic: what will be on origin after a successful push.
  // ahead already-committed + 1 pending commit if there's anything to stage.
  const pushCount = ahead + (pendingChanges > 0 ? 1 : 0);
  // Hard gate: never enable push while there are unresolved conflicts in the
  // working tree — even if there's a separately-staged change. Pushing a
  // half-merged state would land a `_conflicts`-key payload on origin and
  // break peers on next pull.
  const canPush = pushCount > 0 && conflicts === 0;

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 px-3 py-2 flex items-center gap-2">
      <ActionButton
        label={t("action-bar.push", { n: pushCount })}
        variant="primary"
        disabled={!canPush || loading !== null}
        loading={loading === "push"}
        onClick={onPush}
      />
      <ActionButton
        label={isUnborn ? t("action-bar.pull-unborn") : t("action-bar.pull", { n: behind })}
        variant="secondary"
        disabled={(!isUnborn && behind === 0) || loading !== null}
        loading={loading === "pull"}
        onClick={onPull}
      />
      <ActionButton
        label={t("action-bar.resolve", { n: conflicts })}
        variant="danger"
        disabled={conflicts === 0 || loading !== null}
        loading={loading === "resolve"}
        onClick={onResolve}
      />
      <div className="flex-1" />
      <ActionButton
        label={t("action-bar.refresh")}
        variant="ghost"
        disabled={loading !== null}
        loading={loading === "refresh"}
        onClick={onRefresh}
      />
    </div>
  );
}
