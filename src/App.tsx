// Day 5: real init screen, Settings modal, toast-based error surfacing.
// ErrorBanner is now reserved for status-load failures only.

import { useCallback, useState } from "react";
import Header from "./components/Header";
import RemoteBar from "./components/RemoteBar";
import FileTree from "./components/FileTree";
import ActionBar, { type ActionKey } from "./components/ActionBar";
import StatusBar from "./components/StatusBar";
import ErrorBanner from "./components/ErrorBanner";
import InitScreen from "./components/InitScreen";
import SettingsModal from "./components/SettingsModal";
import { useStatus } from "./hooks/useStatus";
import { useRemoteUrl } from "./hooks/useRemoteUrl";
import { useToast } from "./components/Toast";
import { api } from "./lib/api";
import { formatAgo } from "./lib/format";

const errMsg = (e: unknown) => typeof e === "string" ? e : (e as Error)?.message ?? String(e);
const isNotInitialized = (e: string | null) => e !== null && e.toLowerCase().includes("not initialized");

function App() {
  const { status, error, refresh } = useStatus();
  const toast = useToast();
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [initLoading, setInitLoading] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [remoteRefreshKey, setRemoteRefreshKey] = useState<number>(0);
  const remoteUrl = useRemoteUrl(status !== null, remoteRefreshKey);
  const lastSyncLabel = formatAgo(lastSyncAt);

  const runAction = useCallback(async (key: ActionKey, fn: () => Promise<void>) => {
    if (loading !== null) return;
    setLoading(key);
    try { await fn(); }
    catch (e) { const m = errMsg(e); toast.error(`${key} failed: ${m}`); console.error(`[${key}] failed:`, m); }
    finally { setLoading(null); }
  }, [loading, toast]);

  const handlePush = useCallback(() => runAction("push",
    async () => { await api.push(); setLastSyncAt(Date.now()); await refresh(); }), [runAction, refresh]);
  const handlePull = useCallback(() => runAction("pull",
    async () => { await api.pull(); setLastSyncAt(Date.now()); await refresh(); }), [runAction, refresh]);
  const handleRefresh = useCallback(() => runAction("refresh", () => refresh()), [runAction, refresh]);
  const handleResolve = useCallback(() => toast.error(
    "Conflict resolver coming in v0.2 — for now, edit ~/.claude/<file> manually and remove the '_conflicts' key, then push.",
  ), [toast]);
  const handleSettings = useCallback(() => setSettingsOpen(true), []);

  const handleInit = useCallback(async (remote: string) => {
    setInitLoading(true); setInitError(null);
    try {
      await api.init(remote);
      setRemoteRefreshKey((k) => k + 1);
      await refresh();
      toast.success("Initialized! ~/.claude is now synced with the remote.");
    } catch (e) { setInitError(errMsg(e)); }
    finally { setInitLoading(false); }
  }, [refresh, toast]);

  if (isNotInitialized(error)) {
    return (
      <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
        <Header onSettings={handleSettings} onRefresh={handleRefresh} />
        <div className="flex-1 overflow-auto">
          <InitScreen onSubmit={handleInit} loading={initLoading} error={initError} />
        </div>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header onSettings={handleSettings} onRefresh={handleRefresh} />
      {error && <ErrorBanner message={error} />}
      <RemoteBar remote={remoteUrl} lastSyncAgo={lastSyncLabel} onChange={handleSettings} />
      <main className="flex-1 overflow-auto bg-slate-900">
        <FileTree
          changes={status?.changes ?? []}
          tracked={status?.tracked ?? 0}
          excluded_stow={status?.excluded_stow ?? 0}
          excluded_git={status?.excluded_git ?? 0}
        />
      </main>
      <ActionBar status={status} onPush={handlePush} onPull={handlePull}
        onResolve={handleResolve} onRefresh={handleRefresh} loading={loading} />
      <StatusBar status={status} lastSync={lastSyncLabel} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
