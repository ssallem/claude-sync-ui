// ManualRemoteForm — extracted from InitScreen so the "type a remote URL"
// path can coexist with the new OAuth-driven repo-creation flow.
//
// This is intentionally a thin, parent-owned component: the parent supplies
// the submit handler (which usually wires through to `api.init(remote)`),
// the loading flag, and any external init error to surface inline. Local
// state is limited to the input value + a memoised validity check so the
// component stays compatible with React.memo down the line.

import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { isValidRemote } from "../lib/remote-validation";

interface ManualRemoteFormProps {
  onSubmit: (remote: string) => void | Promise<void>;
  loading: boolean;
  // Optional external error fed from the parent (e.g. a failed init call).
  // We render it inline below the input so the user sees it next to the
  // field that caused it. Validation errors stay client-side.
  externalError?: string | null;
  // Optional pre-filled remote URL. Used by InitScreen to recover the
  // clone_url of a repo that was created on GitHub but failed local init —
  // without this, the user would have no way to retry without leaving the
  // app to look up the URL. Empty string ("") = no pre-fill (default).
  initialRemote?: string;
}

export default function ManualRemoteForm({
  onSubmit,
  loading,
  externalError,
  initialRemote = "",
}: ManualRemoteFormProps) {
  const { t } = useTranslation();
  // Initial-state-only — we deliberately don't sync `initialRemote` changes
  // mid-mount because the user might be editing the field, and overwriting
  // their input would be hostile. The parent triggers a remount (key bump)
  // on the rare case where it needs to force-overwrite.
  const [remote, setRemote] = useState<string>(initialRemote);
  const trimmed = remote.trim();
  const valid = useMemo(() => isValidRemote(trimmed), [trimmed]);
  const disabled = loading || trimmed.length === 0 || !valid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    void onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="remote-url"
        className="block text-xs uppercase tracking-wide text-slate-400 mb-1"
      >
        {t("init-screen.remote-url-label")}
      </label>
      <input
        id="remote-url"
        type="text"
        value={remote}
        onChange={(e) => setRemote(e.target.value)}
        placeholder={t("init-screen.placeholder")}
        disabled={loading}
        className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      {trimmed.length > 0 && !valid && !externalError && (
        <p className="mt-1 text-xs text-yellow-400">{t("init-screen.invalid")}</p>
      )}
      {externalError && (
        <p className="mt-2 text-sm text-red-400 break-words" role="alert">
          {externalError}
        </p>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="mt-4 w-full px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t("init-screen.submitting") : t("init-screen.submit")}
      </button>
      <p className="mt-4 text-xs text-slate-500">{t("init-screen.tip")}</p>
    </form>
  );
}
