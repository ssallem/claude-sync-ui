// Settings modal: runs `doctor` on mount, renders the 9-check report with coloured badges,
// and surfaces a placeholder "Change remote" action (v0.2 wires the real command).
// Closes on backdrop click, [Close] button, or Escape key.

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DoctorCheck, DoctorLevel, DoctorResult } from "../types";

interface SettingsModalProps { open: boolean; onClose: () => void; }

const LEVEL_BADGE: Record<DoctorLevel, string> = {
  OK: "bg-emerald-700 text-emerald-50",
  WARN: "bg-yellow-700 text-yellow-50",
  FAIL: "bg-red-700 text-red-50",
};

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setError(null); setDoctor(null);
    api.doctor()
      .then((r) => alive && setDoctor(r))
      .catch((e) => alive && setError(typeof e === "string" ? e : (e as Error)?.message ?? String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const onChangeRemote = () => setError("Changing the remote isn't supported yet. Edit ~/.claude/.git/config manually for now (v0.2 will add a UI).");

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-slate-400 hover:text-slate-100 text-lg leading-none px-2">×</button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 text-sm text-slate-200">
          {loading && <p className="text-slate-400">Running doctor checks...</p>}
          {error && <p className="text-red-400 break-words">{error}</p>}
          {doctor && (
            <div className="space-y-1.5">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                Overall: <span className="font-mono">{doctor.overall}</span>
              </div>
              {doctor.checks.map((c, i) => <CheckRow key={`${c.name}-${i}`} check={c} />)}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-700 flex items-center gap-2">
          <button type="button" onClick={onChangeRemote}
            className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm">
            Change remote
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: DoctorCheck }) {
  const badge = LEVEL_BADGE[check.level as DoctorLevel] ?? "bg-slate-700 text-slate-100";
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${badge}`}>{check.level}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-100">{check.name}</div>
        {check.detail && <div className="text-xs text-slate-400 font-mono break-all">{check.detail}</div>}
      </div>
    </div>
  );
}
