// React hook that owns the StatusResult lifecycle: initial load + manual refresh + error capture.
// The hook itself does NOT decide how errors render — App.tsx routes them to ErrorBanner or (Day 5) the init screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { StatusResult } from "../types";

export type UseStatus = {
  status: StatusResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useStatus(): UseStatus {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against state updates after unmount (StrictMode double-invokes useEffect in dev).
  const mountedRef = useRef<boolean>(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await api.status();
      if (!mountedRef.current) return;
      setStatus(result);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      // Sidecar error messages (e.g. "Not initialized") come through as plain strings from Rust.
      setError(typeof e === "string" ? e : (e as Error)?.message ?? String(e));
      setStatus(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { status, loading, error, refresh };
}
