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
        // Show the URL as long as doctor didn't outright fail to read it. A
        // WARN level (e.g. unreachable remote, auth not validated) still
        // carries the configured URL in `detail` and is far more useful than
        // "(unknown remote)" — the doctor report itself surfaces the warning.
        if (origin && origin.detail && origin.level !== "FAIL") setRemote(origin.detail);
      })
      .catch(() => { /* non-fatal: leave UNKNOWN_REMOTE */ });
    return () => { alive = false; };
  }, [initialized, triggerKey]);
  return remote;
}
