// Bottom-most one-liner: ahead/behind summary + last sync + tracked count.

import type { StatusResult } from "../types";

interface StatusBarProps {
  status: StatusResult | null;
  lastSync: string;
}

export default function StatusBar({ status, lastSync }: StatusBarProps) {
  if (!status) {
    return (
      <div className="bg-slate-950 text-slate-500 text-xs px-3 py-1 border-t border-slate-800">
        Loading status...
      </div>
    );
  }
  const inSync = status.ahead === 0 && status.behind === 0;
  return (
    <div className="bg-slate-950 text-slate-400 text-xs px-3 py-1 border-t border-slate-800 flex items-center gap-3">
      <span className={inSync ? "text-green-400" : "text-yellow-400"}>
        {inSync ? "✓" : "•"} {status.ahead} ahead, {status.behind} behind
      </span>
      <span className="text-slate-600">•</span>
      <span>Last sync {lastSync}</span>
      <span className="text-slate-600">•</span>
      <span>{status.tracked} files tracked</span>
      <div className="flex-1" />
      <span className="font-mono text-slate-500">branch: {status.branch}</span>
    </div>
  );
}
