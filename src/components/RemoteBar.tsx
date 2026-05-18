// Slim grey bar under the header showing the configured remote, local repo and a [Change] action.

import { useTranslation } from "../i18n";

interface RemoteBarProps {
  remote: string;
  lastSyncAgo: string;
  onChange: () => void;
}

export default function RemoteBar({ remote, lastSyncAgo, onChange }: RemoteBarProps) {
  const { t } = useTranslation();
  const syncLabel =
    lastSyncAgo === "never"
      ? t("remote-bar.no-sync-yet")
      : t("remote-bar.last-sync", { time: lastSyncAgo });
  return (
    <div className="bg-slate-800/80 text-slate-200 px-3 py-2 flex items-center justify-between text-xs border-b border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-slate-400">{t("remote-bar.remote-label")}</span>
          <span className="font-mono truncate max-w-[42ch]" title={remote}>
            {remote}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>{t("remote-bar.local-label")}</span>
          <span className="font-mono">~/.claude</span>
          <span>{syncLabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="ml-3 px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition-colors text-slate-100"
      >
        {t("remote-bar.change")}
      </button>
    </div>
  );
}
