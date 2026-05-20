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
import StowignoreModal from "./components/StowignoreModal";
import { useStatus } from "./hooks/useStatus";
import { useRemoteUrl } from "./hooks/useRemoteUrl";
import { useToast } from "./components/Toast";
import { api } from "./lib/api";
import { formatAgo } from "./lib/format";
import { parseSecretScanPaths } from "./lib/stowignore";
import { useTranslation } from "./i18n";
import type { ChangeEntry } from "./types";

const errMsg = (e: unknown) => typeof e === "string" ? e : (e as Error)?.message ?? String(e);
// Route to InitScreen for the sidecar's "Not initialized..." stdout (now normalized to Err
// by Rust commands.rs even on exit 0), plus the underlying git failure that surfaces if the
// repo gets blown away externally. Keep the patterns narrow — don't match generic network
// failures or we'd send the user to InitScreen for transient errors.
const isNotInitialized = (e: string | null): boolean => {
  if (e === null) return false;
  const m = e.toLowerCase();
  if (m.includes("not initialized")) return true;
  // Covers both git's "fatal: not a git repository (...)" wording and any
  // wrapper that includes the canonical "not a git repository" phrase.
  if (m.includes("not a git repository")) return true;
  return false;
};

function App() {
  const { t } = useTranslation();
  const { status, error, refresh } = useStatus();
  const toast = useToast();
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [stowignoreOpen, setStowignoreOpen] = useState<boolean>(false);
  const [initLoading, setInitLoading] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [remoteRefreshKey, setRemoteRefreshKey] = useState<number>(0);
  const [errorDismissed, setErrorDismissed] = useState<boolean>(false);
  const remoteUrl = useRemoteUrl(status !== null, remoteRefreshKey);
  const lastSyncLabel = formatAgo(lastSyncAt);
  const visibleError = error && !errorDismissed ? error : null;

  const runAction = useCallback(async (key: ActionKey, fn: () => Promise<void>) => {
    if (loading !== null) return;
    setLoading(key);
    try { await fn(); }
    catch (e) { const m = errMsg(e); toast.error(t("app.action-failed", { action: key, message: m })); console.error(`[${key}] failed:`, m); }
    finally { setLoading(null); }
  }, [loading, toast, t]);

  const handlePush = useCallback(() => runAction("push",
    async () => {
      setErrorDismissed(false);
      try {
        await api.push();
      } catch (e) {
        const m = errMsg(e);
        // v0.2.6 — sidecar의 거짓 success는 일반 push 실패와 구분된 토스트로
        // 표시. handleCreateStowignore와 동일한 inner-try-catch 패턴 — runAction
        // 의 공통 catch(action-failed 토스트)를 우회하고, runAction의 finally는
        // 정상 동작해 loading 해제.
        if (m.startsWith("push_unverified:")) {
          toast.error(t("app.push-unverified"));
          return;
        }
        throw e;
      }
      setLastSyncAt(Date.now());
      await refresh();
    }
  ), [runAction, refresh, toast, t]);
  const handlePull = useCallback(() => runAction("pull",
    async () => { setErrorDismissed(false); await api.pull(); setLastSyncAt(Date.now()); await refresh(); }), [runAction, refresh]);
  const handleRefresh = useCallback(() => runAction("refresh", async () => { setErrorDismissed(false); await refresh(); }), [runAction, refresh]);
  const handleResolve = useCallback(() => toast.error(t("app.resolve-coming")), [toast, t]);
  const handleSettings = useCallback(() => setSettingsOpen(true), []);

  // Called after a successful set_remote — bump the remote-refresh key so
  // useRemoteUrl re-runs doctor and RemoteBar paints the new URL, plus
  // re-fetch status in case the change made things diverge (e.g. new origin
  // has a different default branch). SettingsModal already shows the success
  // message inline, so we deliberately skip the toast here to avoid double-noise.
  const handleRemoteChanged = useCallback(() => {
    setRemoteRefreshKey((k) => k + 1);
    void refresh();
  }, [refresh]);

  // v0.2.3 hotfix — secret-scan recovery. When claude-sync's init refuses
  // with a "Refusing to initialize: found N potential secret(s)" payload,
  // ErrorBanner surfaces a "Create .stowignore" action. This handler writes
  // the recommended default file via the new Tauri command, surfaces the
  // result as a toast (success → user clicks Initialize again; already-exists
  // → tell them to hand-edit), dismisses the banner, and refreshes status so
  // the InitScreen path can re-evaluate without a full app reload.
  const handleCreateStowignore = useCallback(async () => {
    // v0.2.9 — parse the relevant error (init-time vs status-time) for absolute
    // paths the sidecar reported as containing secrets, and ask Rust to append
    // them to the .stowignore body alongside the default patterns.
    const sourceError = initError ?? visibleError ?? "";
    const detectedPaths = parseSecretScanPaths(sourceError);
    try {
      const result = await api.createSmartStowignore(detectedPaths);
      if (result.action === "created") {
        if (detectedPaths.length > 0) {
          toast.success(t("error-banner.smart-stowignore-success", { n: detectedPaths.length }));
        } else {
          toast.success(t("error-banner.stowignore-success"));
        }
      } else if (result.action === "appended") {
        toast.success(
          t("error-banner.smart-stowignore-appended", { n: result.entries_written }),
        );
      } else {
        // no_change
        toast.info(t("error-banner.stowignore-already-complete"));
      }
      setErrorDismissed(true);
      await refresh();
    } catch (e) {
      const m = errMsg(e);
      // v0.2.10: stowignore_exists is no longer thrown (upsert).
      if (m === "path_outside_claude_dir") {
        toast.error(t("error-banner.path-outside-claude-dir"));
      } else {
        toast.error(t("app.action-failed", { action: "stowignore", message: m }));
      }
    }
  }, [initError, visibleError, toast, t, refresh]);

  // v0.2.5 — double-clicking a FileTree row asks the sidecar to open the
  // file in the OS default editor. Stable Err strings come back from the
  // Rust validator (commands.rs::validate_open_path); we surface them as
  // toasts so the user knows why nothing opened. Wrapped in a synchronous
  // callback because FileTree's `onFileOpen` prop is `(entry) => void`.
  const handleFileOpen = useCallback(
    (entry: ChangeEntry) => {
      api.openInEditor(entry.path).catch((e) => {
        const m = errMsg(e);
        toast.error(t("file-tree.open-failed", { message: m }));
      });
    },
    [toast, t],
  );

  const handleInit = useCallback(async (remote: string) => {
    setInitLoading(true); setInitError(null);
    try {
      await api.init(remote);
      setRemoteRefreshKey((k) => k + 1);
      await refresh();
      toast.success(t("app.init-success"));
    } catch (e) { setInitError(errMsg(e)); }
    finally { setInitLoading(false); }
  }, [refresh, toast, t]);

  if (isNotInitialized(error)) {
    return (
      <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
        <Header onSettings={handleSettings} onRefresh={handleRefresh} />
        <div className="flex-1 overflow-auto">
          <InitScreen
            onSubmit={handleInit}
            loading={initLoading}
            error={initError}
            onCreateStowignore={handleCreateStowignore}
          />
        </div>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          currentRemote={remoteUrl}
          onRemoteChanged={handleRemoteChanged}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header onSettings={handleSettings} onRefresh={handleRefresh} />
      {visibleError && (
        <ErrorBanner
          message={visibleError}
          onDismiss={() => setErrorDismissed(true)}
          onCreateStowignore={handleCreateStowignore}
        />
      )}
      <RemoteBar remote={remoteUrl} lastSyncAgo={lastSyncLabel} onChange={handleSettings} />
      <main className="flex-1 overflow-auto bg-slate-900">
        <FileTree
          changes={status?.changes ?? []}
          tracked={status?.tracked ?? 0}
          excluded_stow={status?.excluded_stow ?? 0}
          excluded_git={status?.excluded_git ?? 0}
          onShowExcluded={() => setStowignoreOpen(true)}
          onFileOpen={handleFileOpen}
        />
      </main>
      <ActionBar status={status} onPush={handlePush} onPull={handlePull}
        onResolve={handleResolve} onRefresh={handleRefresh} loading={loading} />
      <StatusBar status={status} lastSync={lastSyncLabel} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentRemote={remoteUrl}
        onRemoteChanged={handleRemoteChanged}
      />
      <StowignoreModal
        open={stowignoreOpen}
        onClose={() => setStowignoreOpen(false)}
      />
    </div>
  );
}

export default App;
