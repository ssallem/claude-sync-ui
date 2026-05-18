// GitHubAuthFlow — drives the GitHub OAuth Device Flow end-to-end.
//
// The flow is two backend calls:
//   1. `api.githubDeviceStart()` returns a user_code + verification_uri.
//      We display the user_code prominently, copy-to-clipboard it, and try to
//      open the verification_uri in the system browser via tauri-plugin-opener.
//   2. We poll `api.githubDevicePoll(deviceCode, interval)` on the interval
//      GitHub gave us. The Rust side hits GitHub's /login/oauth/access_token
//      and reports back {pending|success|slow_down|expired|denied}.
//
// Implementation notes:
//   - Polling uses a recursive setTimeout (not setInterval) so a `slow_down`
//     response can dynamically lengthen the wait without overlapping calls.
//   - We track the live interval and expiresAt in *refs* (not state) because
//     the poll callback closes over them and we want the latest value without
//     re-scheduling the whole loop on every render.
//   - When the component unmounts (or `tryAgain()` resets), we clear the
//     pending setTimeout AND mark `cancelledRef` so an in-flight invoke that
//     resolves after unmount silently drops its result instead of calling
//     setState on a dead component.
//   - The access token is stored in the OS keyring by the Rust side — the
//     frontend never sees it, so `onSuccess()` carries no payload.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useTranslation } from "../i18n";
import type { DeviceCodeResponse } from "../types";

interface GitHubAuthFlowProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type Phase = "starting" | "awaiting-user" | "polling" | "success" | "error";

// Best-effort browser launcher. Imported lazily so unit tests that don't load
// the Tauri runtime can still mount the component without blowing up.
async function tryOpenUrl(url: string): Promise<void> {
  try {
    const mod = await import("@tauri-apps/plugin-opener");
    await mod.openUrl(url);
  } catch {
    // Plugin not available (e.g. mock-mode browser dev server) or the OS
    // refused the call — fall through silently. The UI still shows the URL
    // as a clickable link, so the user can open it manually.
  }
}

// Best-effort clipboard copy. Returns true if the write succeeded, so the
// caller can flash a "Copied" confirmation only when there's something to
// confirm. We don't surface errors — failed clipboard writes are a UX nuisance
// not worth blocking auth on.
async function tryCopy(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatMmSs(totalSec: number): { min: string; sec: string } {
  const clamped = Math.max(0, totalSec | 0);
  const min = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return { min: String(min), sec: sec.toString().padStart(2, "0") };
}

export default function GitHubAuthFlow({ onSuccess, onCancel }: GitHubAuthFlowProps) {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<Phase>("starting");
  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [copyConfirmed, setCopyConfirmed] = useState<boolean>(false);

  // Refs survive across the recursive polling closure without forcing a
  // re-render every time the interval shifts. We read them inside the poll
  // callback so a `slow_down` response takes effect on the next tick.
  const pollIntervalRef = useRef<number>(0);
  const expiresAtRef = useRef<number | null>(null);
  const deviceCodeRef = useRef<string | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const countdownIdRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);
  // `restartTokenRef` increments on every retry. The poll closure captures
  // its value at scheduling time and aborts if the live value has moved on —
  // this prevents a stale loop from a previous attempt from firing after a
  // user clicks "Try again".
  const restartTokenRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (countdownIdRef.current !== null) {
      window.clearInterval(countdownIdRef.current);
      countdownIdRef.current = null;
    }
  }, []);

  const startFlow = useCallback(async () => {
    cancelledRef.current = false;
    restartTokenRef.current += 1;
    const myToken = restartTokenRef.current;

    clearTimers();
    setPhase("starting");
    setDeviceData(null);
    setErrorKey(null);
    setCopyConfirmed(false);
    setRemainingSec(0);

    let data: DeviceCodeResponse;
    try {
      data = await api.githubDeviceStart();
    } catch {
      if (cancelledRef.current || restartTokenRef.current !== myToken) return;
      setErrorKey("github.error.network");
      setPhase("error");
      return;
    }
    if (cancelledRef.current || restartTokenRef.current !== myToken) return;

    setDeviceData(data);
    pollIntervalRef.current = data.interval;
    deviceCodeRef.current = data.device_code;
    expiresAtRef.current = Date.now() + data.expires_in * 1000;
    setRemainingSec(data.expires_in);
    setPhase("awaiting-user");

    // Fire-and-forget browser open. We don't await — UI shouldn't block on it.
    void tryOpenUrl(data.verification_uri);

    // 1Hz countdown driving the "Expires in mm:ss" label. When it hits zero we
    // surface the expired error directly so the user isn't waiting on the next
    // poll tick to find out.
    countdownIdRef.current = window.setInterval(() => {
      if (expiresAtRef.current === null) return;
      const left = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        // Race-safety: mark cancelled BEFORE clearing timers so an inflight
        // `githubDevicePoll()` that resolves *after* this expiry (but before
        // its own cancelledRef check) drops its result instead of firing
        // onSuccess() against an expired session. `tryAgain()` resets this
        // flag in startFlow() so retries are unaffected.
        cancelledRef.current = true;
        clearTimers();
        if (restartTokenRef.current !== myToken) return;
        setErrorKey("github.error.expired");
        setPhase("error");
      }
    }, 1000);

    // Recursive poll. Captures `myToken` so a retry that bumps the restart
    // counter immediately invalidates this loop on its next tick.
    const schedulePoll = (interval: number) => {
      timeoutIdRef.current = window.setTimeout(async () => {
        if (cancelledRef.current || restartTokenRef.current !== myToken) return;
        if (expiresAtRef.current !== null && Date.now() >= expiresAtRef.current) {
          setErrorKey("github.error.expired");
          setPhase("error");
          clearTimers();
          return;
        }
        let result;
        try {
          result = await api.githubDevicePoll(
            deviceCodeRef.current!,
            pollIntervalRef.current,
          );
        } catch {
          if (cancelledRef.current || restartTokenRef.current !== myToken) return;
          // Treat invoke errors as transient — show a network message but stop
          // looping. The user can hit "Try again" to restart cleanly.
          setErrorKey("github.error.network");
          setPhase("error");
          clearTimers();
          return;
        }
        if (cancelledRef.current || restartTokenRef.current !== myToken) return;

        if (result.status === "success") {
          setPhase("success");
          clearTimers();
          onSuccess();
          return;
        }
        if (result.status === "expired") {
          setErrorKey("github.error.expired");
          setPhase("error");
          clearTimers();
          return;
        }
        if (result.status === "denied") {
          setErrorKey("github.error.denied");
          setPhase("error");
          clearTimers();
          return;
        }
        if (result.status === "slow_down" && result.new_interval != null) {
          // GitHub asked us to back off — adopt the new interval for *all*
          // future polls in this attempt and reschedule with it.
          pollIntervalRef.current = result.new_interval;
          setPhase("polling");
          schedulePoll(result.new_interval);
          return;
        }
        // pending → keep polling at the current interval.
        setPhase("polling");
        schedulePoll(pollIntervalRef.current);
      }, interval * 1000);
    };

    schedulePoll(data.interval);
  }, [clearTimers, onSuccess]);

  // Kick off on mount, and tear down all timers on unmount. The `cancelledRef`
  // flag prevents a late-resolving invoke from calling setState after teardown.
  useEffect(() => {
    void startFlow();
    return () => {
      cancelledRef.current = true;
      clearTimers();
    };
    // Intentionally empty deps: startFlow is stable (memoised) but we only
    // want to fire on mount. `tryAgain()` triggers subsequent starts manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = useCallback(async () => {
    if (!deviceData) return;
    const ok = await tryCopy(deviceData.user_code);
    if (ok) {
      setCopyConfirmed(true);
      window.setTimeout(() => setCopyConfirmed(false), 1500);
    }
  }, [deviceData]);

  const handleOpenBrowser = useCallback(() => {
    if (!deviceData) return;
    void tryOpenUrl(deviceData.verification_uri);
  }, [deviceData]);

  const handleTryAgain = useCallback(() => {
    void startFlow();
  }, [startFlow]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    onCancel();
  }, [clearTimers, onCancel]);

  // ---------- UI ----------------------------------------------------------

  const { min, sec } = formatMmSs(remainingSec);

  return (
    <div
      className="h-full flex items-center justify-center p-6 bg-slate-900 text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-label="GitHub sign-in"
    >
      <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl">
        {phase === "starting" && (
          <div className="flex items-center gap-3 py-6">
            <Spinner />
            <p className="text-sm text-slate-300">{t("github.auth.preparing")}</p>
          </div>
        )}

        {(phase === "awaiting-user" || phase === "polling") && deviceData && (
          <>
            <p className="text-sm text-slate-300">
              {t("github.auth.enter-code-at", { url: "" })}
              <a
                href={deviceData.verification_uri}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-400 hover:text-blue-300 underline break-all"
              >
                {deviceData.verification_uri}
              </a>
            </p>

            <div
              className="font-mono text-4xl tracking-[0.5em] text-center text-blue-400 my-6 select-all"
              aria-label="user code"
            >
              {deviceData.user_code}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
              >
                {copyConfirmed
                  ? t("github.auth.copy-success")
                  : t("github.auth.copy-code")}
              </button>
              <button
                type="button"
                onClick={handleOpenBrowser}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium"
              >
                {t("github.auth.open-browser")}
              </button>
              <div className="flex-1" />
              <span className="text-xs text-slate-400 font-mono" aria-live="polite">
                {t("github.auth.expires-in", { min, sec })}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4 text-xs text-slate-400">
              <Spinner small />
              <span>{t("github.auth.polling")}</span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              {t("github.auth.scope-notice")}
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
              >
                {t("github.auth.cancel")}
              </button>
            </div>
          </>
        )}

        {phase === "success" && (
          <p
            className="text-sm text-emerald-400 py-6 text-center"
            role="status"
          >
            {t("github.auth.success")}
          </p>
        )}

        {phase === "error" && (
          <>
            <p
              className="text-sm text-red-400 break-words mb-4"
              role="alert"
            >
              {errorKey ? t(errorKey) : t("github.error.network")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
              >
                {t("github.auth.cancel")}
              </button>
              <button
                type="button"
                onClick={handleTryAgain}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
              >
                {t("github.auth.try-again")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "h-3 w-3 border-2" : "h-5 w-5 border-2";
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${size} border-slate-500 border-t-blue-400 rounded-full animate-spin`}
    />
  );
}
