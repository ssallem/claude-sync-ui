// Single-letter coloured pill for a file change kind.
// Mapping: M(yellow)/A(green)/D(gray)/?(blue)/!(red)/synced(muted).

type BadgeKind = "M" | "A" | "D" | "?" | "!" | "synced" | string;

interface StatusBadgeProps {
  kind: BadgeKind;
}

interface BadgeStyle {
  label: string;
  className: string;
  title: string;
}

function styleFor(kind: BadgeKind): BadgeStyle {
  switch (kind) {
    case "M":
      return { label: "M", className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40", title: "Modified" };
    case "A":
      return { label: "A", className: "bg-green-500/20 text-green-300 border-green-500/40", title: "Added" };
    case "D":
      return { label: "D", className: "bg-gray-500/20 text-gray-300 border-gray-500/40", title: "Deleted" };
    case "?":
      return { label: "?", className: "bg-blue-500/20 text-blue-300 border-blue-500/40", title: "Untracked" };
    case "!":
      return { label: "!", className: "bg-red-500/25 text-red-300 border-red-500/50", title: "Conflict" };
    case "synced":
      return { label: "S", className: "bg-slate-700/40 text-slate-400 border-slate-600/50", title: "Synced" };
    default:
      return { label: String(kind).slice(0, 1) || "?", className: "bg-slate-700/40 text-slate-300 border-slate-600/50", title: String(kind) };
  }
}

export default function StatusBadge({ kind }: StatusBadgeProps) {
  const { label, className, title } = styleFor(kind);
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border ${className}`}
    >
      {label}
    </span>
  );
}
