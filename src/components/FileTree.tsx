// Groups ChangeEntry items by their leading directory and renders a simple tree.
// Files at the repo root land in a "(root)" bucket. All groups start expanded — Day 3 has no toggle yet.

import { useMemo } from "react";
import type { ChangeEntry } from "../types";
import StatusBadge from "./StatusBadge";
import { useTranslation } from "../i18n";

interface FileTreeProps {
  changes: ChangeEntry[];
  tracked: number;
  excluded_stow: number;
  excluded_git: number;
}

interface Group {
  dir: string;
  entries: { name: string; entry: ChangeEntry }[];
}

function groupByDir(changes: ChangeEntry[], rootLabel: string): Group[] {
  const map = new Map<string, { name: string; entry: ChangeEntry }[]>();
  for (const c of changes) {
    const normalized = c.path.replace(/\\/g, "/");
    const idx = normalized.indexOf("/");
    const dir = idx === -1 ? rootLabel : normalized.slice(0, idx);
    const name = idx === -1 ? normalized : normalized.slice(idx + 1);
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir)!.push({ name, entry: c });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, entries]) => ({ dir, entries: entries.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export default function FileTree({ changes, tracked, excluded_stow, excluded_git }: FileTreeProps) {
  const { t } = useTranslation();
  const rootLabel = t("file-tree.root-bucket");
  const groups = useMemo(() => groupByDir(changes, rootLabel), [changes, rootLabel]);

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="flex-1 overflow-auto px-3 py-2">
        {changes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic">
            {t("file-tree.empty")}
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.dir}>
                <div className="flex items-center gap-1 text-slate-300 font-medium">
                  <span className="text-slate-500">▼</span>
                  <span className="font-mono">{g.dir === rootLabel ? g.dir : `${g.dir}/`}</span>
                  <span className="text-xs text-slate-500">({g.entries.length})</span>
                </div>
                <ul className="mt-1 pl-6 space-y-1">
                  {g.entries.map(({ name, entry }) => (
                    <li key={entry.path} className="flex items-center justify-between gap-3 group">
                      <span className="font-mono text-slate-200 truncate" title={entry.path}>
                        {name}
                      </span>
                      <StatusBadge kind={entry.kind} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-800 bg-slate-900/60">
        {t("file-tree.tracking", { n: tracked, stow: excluded_stow, git: excluded_git })}
      </div>
    </div>
  );
}
