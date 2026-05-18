// Bottom-most one-liner: ahead/behind summary + last sync + tracked count.

import type { StatusResult } from "../types";
import { useTranslation } from "../i18n";

interface StatusBarProps {
  status: StatusResult | null;
  lastSync: string;
}

export default function StatusBar({ status, lastSync }: StatusBarProps) {
  const { t } = useTranslation();
  if (!status) {
    return (
      <div className="bg-slate-950 text-slate-500 text-xs px-3 py-1 border-t border-slate-800">
        {t("status-bar.loading")}
      </div>
    );
  }
  const inSync = status.ahead === 0 && status.behind === 0;
  return (
    <div className="bg-slate-950 text-slate-400 text-xs px-3 py-1 border-t border-slate-800 flex items-center gap-3">
      <span className={inSync ? "text-green-400" : "text-yellow-400"}>
        {inSync ? "✓" : "•"} {t("status-bar.summary", { ahead: status.ahead, behind: status.behind })}
      </span>
      <span className="text-slate-600">•</span>
      <span>{t("status-bar.last-sync", { time: lastSync })}</span>
      <span className="text-slate-600">•</span>
      <span>{t("status-bar.files-tracked", { n: status.tracked })}</span>
      <div className="flex-1" />
      <span className="font-mono text-slate-500">{t("status-bar.branch", { branch: status.branch })}</span>
    </div>
  );
}
