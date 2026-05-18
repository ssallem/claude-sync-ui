// Top bar: brand on the left, [Settings] + [Refresh] on the right.
// Text-only labels — no icon library per Day 3 spec.

import { useTranslation } from "../i18n";

interface HeaderProps {
  onSettings: () => void;
  onRefresh: () => void;
}

export default function Header({ onSettings, onRefresh }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="bg-slate-900 text-white p-3 flex justify-between items-center border-b border-slate-800">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">claude-sync</span>
        <span className="text-xs text-slate-400">MVP</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSettings}
          className="px-3 py-1 text-sm rounded-md bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors"
        >
          {t("header.settings")}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1 text-sm rounded-md bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors"
        >
          {t("header.refresh")}
        </button>
      </div>
    </header>
  );
}
