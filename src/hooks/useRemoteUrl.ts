// Small hook that reads the configured Git remote URL out of `claude-sync doctor`.
// Fires once after `triggerKey` flips, and only when initialized is true (no point calling
// doctor when the repo isn't set up). Returns a fallback string for the UI's RemoteBar.

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export const UNKNOWN_REMOTE = "(unknown remote)";

export function useRemoteUrl(initialized: boolean, triggerKey: number): string {
  const [remote, setRemote] = useState<string>(UNKNOWN_REMOTE);
  useEffect(() => {
    if (!initialized) return;
    let alive = true;
    api.doctor()
      .then((d) => {
        if (!alive) return;
        const origin = d.checks.find((c) => c.name.toLowerCase() === "remote origin");
        if (origin && origin.detail && origin.level === "OK") setRemote(origin.detail);
      })
      .catch(() => { /* non-fatal: leave UNKNOWN_REMOTE */ });
    return () => { alive = false; };
  }, [initialized, triggerKey]);
  return remote;
}
