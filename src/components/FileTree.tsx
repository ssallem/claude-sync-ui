// Groups ChangeEntry items by their leading directory and renders a simple tree.
// Files at the repo root land in a "(root)" bucket. v0.2.4: groups are
// click-to-toggle (▼ expanded / ▶ collapsed) — until then the ▼ glyph looked
// like a button but was inert, and there was no way to hide a noisy bucket.
// v0.2.4 also surfaces an inline "what is excluded" inspector triggered from
// the tracking-count footer so users can self-verify that per-machine
// directories (projects/, file-history/, ...) are actually being skipped.

import { useMemo, useState } from "react";
import type { ChangeEntry } from "../types";
import StatusBadge from "./StatusBadge";
import { useTranslation } from "../i18n";

interface FileTreeProps {
  changes: ChangeEntry[];
  tracked: number;
  excluded_stow: number;
  excluded_git: number;
  // v0.2.4: clicking the footer "stow N / git M" counts opens the
  // .stowignore inspector. App.tsx wires this to a modal that reads
  // the user's ~/.claude/.stowignore via a Tauri command.
  onShowExcluded?: () => void;
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

export default function FileTree({
  changes,
  tracked,
  excluded_stow,
  excluded_git,
  onShowExcluded,
}: FileTreeProps) {
  const { t } = useTranslation();
  const rootLabel = t("file-tree.root-bucket");
  const groups = useMemo(() => groupByDir(changes, rootLabel), [changes, rootLabel]);
  // Set of dir keys the user has manually collapsed. Default = expanded for
  // every dir we know about (matches the pre-v0.2.4 behavior). Per-session
  // only — not persisted, since which dirs you care about depends on what
  // changed *this* session and a remembered collapse from yesterday is more
  // confusing than helpful.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (dir: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="flex-1 overflow-auto px-3 py-2">
        {changes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic">
            {t("file-tree.empty")}
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.dir);
              return (
                <li key={g.dir}>
                  <button
                    type="button"
                    onClick={() => toggle(g.dir)}
                    aria-expanded={!isCollapsed}
                    className="flex items-center gap-1 text-slate-300 font-medium cursor-pointer hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1 w-full text-left"
                  >
                    <span className="text-slate-500 w-3 inline-block">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="font-mono">
                      {g.dir === rootLabel ? g.dir : `${g.dir}/`}
                    </span>
                    <span className="text-xs text-slate-500">({g.entries.length})</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="mt-1 pl-6 space-y-1">
                      {g.entries.map(({ name, entry }) => (
                        <li
                          key={entry.path}
                          className="flex items-center justify-between gap-3 group"
                        >
                          <span
                            className="font-mono text-slate-200 truncate"
                            title={entry.path}
                          >
                            {name}
                          </span>
                          <StatusBadge kind={entry.kind} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="px-3 py-2 text-xs border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
        <span className="text-slate-400">
          {t("file-tree.tracking", { n: tracked, stow: excluded_stow, git: excluded_git })}
        </span>
        {onShowExcluded && (excluded_stow > 0 || excluded_git > 0) && (
          <button
            type="button"
            onClick={onShowExcluded}
            className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
          >
            {t("file-tree.show-excluded")}
          </button>
        )}
      </div>
    </div>
  );
}
