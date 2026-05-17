// Bottom action row: Push / Pull / Resolve / Refresh.
// Counts derive from StatusResult; zero-count buttons render disabled.

import { useMemo } from "react";
import type { StatusResult } from "../types";

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
  count?: number;
  variant: "primary" | "secondary" | "danger" | "ghost";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

function ActionButton({ label, count, variant, disabled, loading, onClick }: ActionButtonProps) {
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
      {typeof count === "number" && <span className="font-mono text-xs">{count}</span>}
      {loading && <span className="animate-pulse">...</span>}
    </button>
  );
}

export default function ActionBar({ status, onPush, onPull, onResolve, onRefresh, loading }: ActionBarProps) {
  const ahead = status?.ahead ?? 0;
  const behind = status?.behind ?? 0;
  const conflicts = useMemo(
    () => (status?.changes ?? []).filter((c) => c.kind === "!").length,
    [status],
  );

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 px-3 py-2 flex items-center gap-2">
      <ActionButton
        label={`Push ${ahead}↑`}
        variant="primary"
        disabled={ahead === 0 || loading !== null}
        loading={loading === "push"}
        onClick={onPush}
      />
      <ActionButton
        label={`Pull ${behind}↓`}
        variant="secondary"
        disabled={behind === 0 || loading !== null}
        loading={loading === "pull"}
        onClick={onPull}
      />
      <ActionButton
        label={`Resolve Conflicts (${conflicts})`}
        variant="danger"
        disabled={conflicts === 0 || loading !== null}
        loading={loading === "resolve"}
        onClick={onResolve}
      />
      <div className="flex-1" />
      <ActionButton
        label="Refresh"
        variant="ghost"
        disabled={loading !== null}
        loading={loading === "refresh"}
        onClick={onRefresh}
      />
    </div>
  );
}
