// First-run screen shown when `claude-sync status` reports the repo is not initialized.
// Asks the user for a Git remote (https://, git@, or local path) and forwards it to the parent's
// onSubmit. The parent owns the actual `api.init(remote)` call and decides what to render next.

import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { isValidRemote } from "../lib/remote-validation";

interface InitScreenProps {
  onSubmit: (remote: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function InitScreen({ onSubmit, loading, error }: InitScreenProps) {
  const { t } = useTranslation();
  const [remote, setRemote] = useState<string>("");
  const trimmed = remote.trim();
  const valid = useMemo(() => isValidRemote(trimmed), [trimmed]);
  const disabled = loading || trimmed.length === 0 || !valid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    void onSubmit(trimmed);
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-900 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl"
      >
        <h1 className="text-2xl font-semibold mb-2">{t("init-screen.welcome")}</h1>
        <p className="text-sm text-slate-300 mb-4">{t("init-screen.description")}</p>
        <label htmlFor="remote-url" className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
          {t("init-screen.remote-url-label")}
        </label>
        <input
          id="remote-url"
          type="text"
          value={remote}
          onChange={(e) => setRemote(e.target.value)}
          placeholder={t("init-screen.placeholder")}
          autoFocus
          disabled={loading}
          className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {trimmed.length > 0 && !valid && !error && (
          <p className="mt-1 text-xs text-yellow-400">{t("init-screen.invalid")}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-400 break-words" role="alert">
            {error}
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
    </div>
  );
}
