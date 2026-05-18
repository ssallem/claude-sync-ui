// Settings modal: runs `doctor` on mount, renders the 9-check report with coloured badges,
// and exposes an inline "Change remote" form that rewrites ~/.claude/.git/config in place.
// Closes on backdrop click, [Close] button, or Escape key.

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { DoctorCheck, DoctorLevel, DoctorResult } from "../types";
import { useTranslation, type Lang } from "../i18n";
import { isValidRemote } from "../lib/remote-validation";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  // Current remote URL, used as the placeholder/seed for the change-remote form.
  currentRemote?: string;
  // Fires after a successful remote change so the parent can refresh status + remote URL.
  onRemoteChanged?: () => void;
}

const LEVEL_BADGE: Record<DoctorLevel, string> = {
  OK: "bg-emerald-700 text-emerald-50",
  WARN: "bg-yellow-700 text-yellow-50",
  FAIL: "bg-red-700 text-red-50",
};

const errMsg = (e: unknown): string =>
  typeof e === "string" ? e : (e as Error)?.message ?? String(e);

export default function SettingsModal({
  open,
  onClose,
  currentRemote,
  onRemoteChanged,
}: SettingsModalProps) {
  const { t, lang, setLang } = useTranslation();
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Inline change-remote form state. `editing` toggles the form; we reset it
  // whenever the modal closes so reopening always starts collapsed.
  const [editing, setEditing] = useState<boolean>(false);
  const [newRemote, setNewRemote] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const trimmed = newRemote.trim();
  const valid = useMemo(() => isValidRemote(trimmed), [trimmed]);
  const disabledUpdate = updating || trimmed.length === 0 || !valid;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setDoctor(null);
    api
      .doctor()
      .then((r) => alive && setDoctor(r))
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);

  // Reset the inline form whenever the modal closes — opening it again should
  // always present the collapsed "Change remote" button, not a stale form.
  useEffect(() => {
    if (!open) {
      setEditing(false);
      setNewRemote("");
      setUpdateError(null);
      setSuccessMsg(null);
      setUpdating(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleStartEdit = () => {
    setEditing(true);
    setUpdateError(null);
    setSuccessMsg(null);
    // Seed the input with the current remote so the user can tweak instead of retype.
    setNewRemote(currentRemote && currentRemote !== "(unknown remote)" ? currentRemote : "");
  };

  const handleCancel = () => {
    setEditing(false);
    setNewRemote("");
    setUpdateError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabledUpdate) return;
    setUpdating(true);
    setUpdateError(null);
    setSuccessMsg(null);
    try {
      await api.setRemote(trimmed);
      setSuccessMsg(t("settings-modal.update-success"));
      // Let the parent refresh status + remote URL display.
      onRemoteChanged?.();
      // Close the modal after a beat so the user sees the success state,
      // then the parent's refresh paints the new remote in RemoteBar.
      window.setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setUpdateError(errMsg(err));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings-modal.title")}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{t("settings-modal.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("settings-modal.close-aria")}
            className="text-slate-400 hover:text-slate-100 text-lg leading-none px-2"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 text-sm text-slate-200">
          {loading && <p className="text-slate-400">{t("settings-modal.running")}</p>}
          {error && <p className="text-red-400 break-words">{error}</p>}
          {doctor && (
            <div className="space-y-1.5">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                {t("settings-modal.overall")} <span className="font-mono">{doctor.overall}</span>
              </div>
              {doctor.checks.map((c, i) => (
                <CheckRow key={`${c.name}-${i}`} check={c} />
              ))}
            </div>
          )}

          {editing && (
            <form
              onSubmit={handleUpdate}
              className="mt-4 p-3 rounded-md bg-slate-900 border border-slate-700 space-y-2"
              aria-label={t("settings-modal.change-remote")}
            >
              <label
                htmlFor="settings-new-remote"
                className="block text-xs uppercase tracking-wide text-slate-400"
              >
                {t("settings-modal.new-remote-label")}
              </label>
              <input
                id="settings-new-remote"
                type="text"
                value={newRemote}
                onChange={(e) => setNewRemote(e.target.value)}
                placeholder={currentRemote || t("settings-modal.new-remote-placeholder")}
                autoFocus
                disabled={updating}
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {trimmed.length > 0 && !valid && (
                <p className="text-xs text-yellow-400">{t("settings-modal.invalid-remote")}</p>
              )}
              {updateError && (
                <p className="text-sm text-red-400 break-words" role="alert">
                  {updateError}
                </p>
              )}
              {successMsg && (
                <p className="text-sm text-emerald-400" role="status">
                  {successMsg}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={disabledUpdate}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? t("settings-modal.updating") : t("settings-modal.update")}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={updating}
                  className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-50"
                >
                  {t("settings-modal.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-700 flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartEdit}
            disabled={editing}
            className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("settings-modal.change-remote")}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            <span>{t("settings-modal.language")}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t("settings-modal.language")}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            {t("settings-modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: DoctorCheck }) {
  const { t } = useTranslation();
  const badge = LEVEL_BADGE[check.level as DoctorLevel] ?? "bg-slate-700 text-slate-100";
  // Map known levels to translated labels; unknown levels fall through to the raw string.
  const levelLabel =
    check.level === "OK"
      ? t("doctor.level.ok")
      : check.level === "WARN"
        ? t("doctor.level.warn")
        : check.level === "FAIL"
          ? t("doctor.level.fail")
          : String(check.level);
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${badge}`}>
        {levelLabel}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-100">{check.name}</div>
        {check.detail && (
          <div className="text-xs text-slate-400 font-mono break-all">{check.detail}</div>
        )}
      </div>
    </div>
  );
}
