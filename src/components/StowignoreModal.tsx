// v0.2.4 — .stowignore inspector modal.
// Triggered from FileTree's footer "view excluded" link. Loads the user's
// ~/.claude/.stowignore via the Tauri command and shows the raw body so the
// user can self-verify which paths are being skipped from sync (the dogfood
// concern was "does projects/ get synced or not?" — they want to *see* the
// rule, not just trust the exclusion count).

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useTranslation } from "../i18n";

interface StowignoreModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StowignoreModal({ open, onClose }: StowignoreModalProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Refetch every time the modal opens so a user edit between opens is
  // reflected. Reset state on close so a stale error from a prior open
  // doesn't flash on the next open before the new fetch completes.
  useEffect(() => {
    if (!open) {
      setBody(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .readStowignore()
      .then((b) => {
        if (!cancelled) {
          setBody(b);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(typeof e === "string" ? e : (e as Error)?.message ?? String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Close on Escape key, matching SettingsModal UX.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stowignore-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h2 id="stowignore-modal-title" className="text-slate-100 font-semibold">
            {t("stowignore-modal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("stowignore-modal.close-aria")}
            className="text-slate-400 hover:text-slate-100 w-8 h-8 flex items-center justify-center rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-3 text-xs text-slate-400 border-b border-slate-800">
          {t("stowignore-modal.description")}
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          {loading && (
            <div className="text-slate-400 italic">{t("stowignore-modal.loading")}</div>
          )}
          {!loading && error && (
            <div className="text-red-400 whitespace-pre-wrap font-mono text-xs">
              {error}
            </div>
          )}
          {!loading && !error && body !== null && body.length === 0 && (
            <div className="text-slate-400 italic">{t("stowignore-modal.empty")}</div>
          )}
          {!loading && !error && body !== null && body.length > 0 && (
            <pre className="text-slate-200 font-mono text-xs whitespace-pre-wrap break-words">
              {body}
            </pre>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md font-medium bg-slate-700 hover:bg-slate-600 text-slate-100"
          >
            {t("stowignore-modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
