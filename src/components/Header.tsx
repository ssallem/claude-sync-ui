// Top bar: brand on the left, [Settings] + [Refresh] on the right.
// Text-only labels — no icon library per Day 3 spec.
//
// v0.2.8 — added a prominent "Sign out" button so users have a discoverable
// GitHub logout entry point. Previously the only path was the buried entry
// inside the Settings modal, which dogfood users couldn't find. The button
// is rendered conditionally based on `github_is_logged_in` so it stays out
// of the way when no token exists.

import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import { api } from "../lib/api";
import { useToast } from "./Toast";

interface HeaderProps {
  onSettings: () => void;
  onRefresh: () => void;
}

export default function Header({ onSettings, onRefresh }: HeaderProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [githubLoggedIn, setGithubLoggedIn] = useState<boolean>(false);
  const [logoutBusy, setLogoutBusy] = useState<boolean>(false);

  // Mount-time check whether the user has a stored GitHub token. The Header
  // is mounted on app start so this fires once. We use the same `alive` flag
  // pattern as SettingsModal:62-76 to avoid setState on an unmounted component
  // during a slow IPC.
  useEffect(() => {
    let alive = true;
    api
      .githubIsLoggedIn()
      .then((v) => {
        if (alive) setGithubLoggedIn(v);
      })
      .catch(() => {
        // Fail-safe: treat any error as "not logged in" so we don't show a
        // dead Sign out button. The user can still log in/out via Settings.
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await api.githubLogout();
      setGithubLoggedIn(false);
      toast.success(t("header.github-logout-success"));
    } catch (e) {
      toast.error(typeof e === "string" ? e : (e as Error)?.message ?? String(e));
    } finally {
      setLogoutBusy(false);
    }
  };

  return (
    <header className="bg-slate-900 text-white p-3 flex justify-between items-center border-b border-slate-800">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">claude-sync</span>
        <span className="text-xs text-slate-400">v{__APP_VERSION__}</span>
      </div>
      <div className="flex items-center gap-2">
        {githubLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutBusy}
            className="px-3 py-1 text-sm rounded-md bg-amber-700 hover:bg-amber-600 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
          >
            {t("header.github-logout")}
          </button>
        )}
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
