// v0.2.3 hotfix — full-width error surface used for status-load failures.
//
// Background: the v0.2.2 dogfood revealed that claude-sync's secret-scan
// can emit a 3,000+ character error listing dozens of file:line:offset
// findings when refusing to init. The previous one-line "truncate + tooltip"
// implementation completely covered the screen, and on the worst case the
// user couldn't even find the dismiss button. This rewrite:
//
//   1. Caps the banner at 40vh and scrolls inside it so it can never eat
//      the whole window.
//   2. Folds long messages into a `<details>`-style collapsible — short
//      messages (< 200 chars and < 3 line breaks) render fully without UI
//      chrome, so we don't regress the common case.
//   3. Keeps the dismiss button (top-right, 40x40 hit target, large × glyph)
//      always visible regardless of message length — fixes the "user wanted
//      to kill the program because they couldn't find the X" bug.
//   4. Pattern-matches the canonical secret-scan refusal wording and, when
//      detected, surfaces a single action button that calls back into the
//      parent to write a default `~/.claude/.stowignore`. This makes
//      first-run recovery one click instead of a doc-spelunk.
//
// Props stay backward-compatible: `onCreateStowignore` is optional. App.tsx
// passes it only on the main route; tests that render ErrorBanner standalone
// don't need to thread anything through.

import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  // Called when the user clicks "Create .stowignore" on a detected
  // secret-scan refusal. Parent decides what to do (typically:
  // api.createDefaultStowignore() + toast + refresh). Async-aware so the
  // button can show a disabled state while the call is in flight.
  onCreateStowignore?: () => void | Promise<void>;
}

// Heuristic — long enough that the verbatim render dominates the screen
// or jumbles user attention. These two thresholds match the worst-case
// dogfood payload (44-secret listing was ~3000 chars + 44 newlines) while
// leaving short messages untouched.
const COLLAPSE_CHAR_THRESHOLD = 200;
const COLLAPSE_LINE_THRESHOLD = 3;

// The sidecar's secret-scan refusal is identifiable from two stable
// substrings — checking either is enough but matching both narrows false
// positives. The wording lives in claude-sync's commands::init source.
export function isSecretScanError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("refusing to initialize: found") || m.includes("potential secret(s)")
  );
}

function shouldCollapse(message: string): boolean {
  if (message.length > COLLAPSE_CHAR_THRESHOLD) return true;
  // Count newlines — '\n' splits into N+1 segments; we want raw line breaks.
  let lineBreaks = 0;
  for (const ch of message) if (ch === "\n") lineBreaks++;
  return lineBreaks > COLLAPSE_LINE_THRESHOLD;
}

// First 2 non-empty lines (or first ~160 chars if it's all one giant line)
// used as the always-visible preview. Truncating mid-word with an ellipsis
// is fine here — the user can always expand for the rest.
function previewOf(message: string): string {
  const lines = message.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length >= 2) {
    const head = lines.slice(0, 2).join("\n");
    return head.length > 320 ? head.slice(0, 320) + "…" : head;
  }
  if (lines.length === 1 && lines[0].length > 160) {
    return lines[0].slice(0, 160) + "…";
  }
  return message;
}

export default function ErrorBanner({
  message,
  onDismiss,
  onCreateStowignore,
}: ErrorBannerProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [actionInFlight, setActionInFlight] = useState<boolean>(false);

  const collapsible = useMemo(() => shouldCollapse(message), [message]);
  const secretScan = useMemo(() => isSecretScanError(message), [message]);
  const preview = useMemo(() => previewOf(message), [message]);

  const showFullMessage = !collapsible || expanded;

  const handleCreateStowignore = async () => {
    if (!onCreateStowignore || actionInFlight) return;
    setActionInFlight(true);
    try {
      await onCreateStowignore();
    } finally {
      setActionInFlight(false);
    }
  };

  return (
    <div
      role="alert"
      className="relative bg-red-600 text-white border-b border-red-700 max-h-[40vh] overflow-y-auto"
    >
      {/* Dismiss button — fixed top-right, big hit target, lives above the
         scroll content so it's always reachable even when the message
         overflows. aria-label is the long form so screen readers don't just
         hear "X". */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("error-banner.dismiss-aria")}
          className="absolute top-1 right-1 w-10 h-10 flex items-center justify-center rounded hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          <span aria-hidden="true" className="text-2xl leading-none">
            ×
          </span>
        </button>
      )}

      <div className="px-3 py-2 pr-12">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold uppercase tracking-wide text-xs">
            {t("error-banner.label")}
          </span>
        </div>

        {/* Body. Short messages render in a single line; long messages render
           as preformatted multi-line text so the file:line listings line up. */}
        {showFullMessage ? (
          <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-snug m-0">
            {message}
          </pre>
        ) : (
          <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-snug m-0">
            {preview}
          </pre>
        )}

        {/* Toggle + secret-scan action live on the same row so the user
           sees both affordances together. */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-800 active:bg-red-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              {expanded ? t("error-banner.show-less") : t("error-banner.show-more")}
            </button>
          )}
          {secretScan && onCreateStowignore && (
            <button
              type="button"
              onClick={handleCreateStowignore}
              disabled={actionInFlight}
              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-red-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t("error-banner.create-stowignore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
