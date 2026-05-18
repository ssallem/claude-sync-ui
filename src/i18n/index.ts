// Tiny self-contained i18n runtime — ~1KB minified, no external deps.
//
// Why not i18next/react-i18next? We only need 49 keys, one plural pattern, and
// `{name}` interpolation. The whole behaviour fits in ~80 lines and avoids
// adding ~40KB of bundle weight. If the dictionary grows past ~200 keys, or we
// need ICU MessageFormat / per-component lazy loading, swap this out for
// i18next at that point — public surface (`useTranslation`, `LanguageProvider`)
// is designed to be drop-in compatible.
//
// Public surface:
//   <LanguageProvider>      — wraps the app, owns `lang` state, syncs localStorage
//   useTranslation()        — returns { t, lang, setLang }
//   t(key, params?)         — interpolates `{name}` placeholders. If `params.n`
//                              is provided and a `<key>_one` / `<key>_other`
//                              pair exists, auto-picks based on n === 1.
//
// Initial language is decided once at module load:
//   1. localStorage.getItem("lang")           — explicit user choice persists
//   2. navigator.language.startsWith("ko")    — Korean browsers default to ko
//   3. fallback: "en"
//
// Missing-key fallback chain:
//   active locale → English → key string itself (with console.warn in dev)

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { ko } from "./ko";

export type Lang = "ko" | "en";

// Dict is intentionally loose (Record<string, string>) so locale files can
// `import type { Dict }` without a circular dependency on `en.ts`. The actual
// key safety comes from TypeScript inferring the literal key set from `en` —
// `TranslationKey` below is the canonical key list.
export type Dict = Record<string, string>;

export type TranslationKey = keyof typeof en;

type InterpolationParams = Record<string, string | number>;

const LANG_STORAGE_KEY = "lang";

const DICTS: Record<Lang, Dict> = { en, ko };

function detectInitialLang(): Lang {
  // SSR guard — we still want a sane default if this ever runs in Node.
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "ko" || stored === "en") return stored;
  } catch {
    // localStorage can throw in private-mode Safari / sandboxed iframes —
    // silently fall through to the browser-locale heuristic.
  }
  if (typeof navigator !== "undefined" && navigator.language?.startsWith("ko")) {
    return "ko";
  }
  return "en";
}

function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;
  // Replace every `{name}` with the matching param, leaving unknown placeholders
  // intact so a typo surfaces as `{foo}` in the UI instead of `undefined`.
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

function lookup(lang: Lang, key: string): string | undefined {
  return DICTS[lang][key];
}

export function translate(lang: Lang, key: string, params?: InterpolationParams): string {
  // Plural branching: if `params.n` is present and `<key>_one` / `<key>_other`
  // exists, swap `key` for the variant before normal lookup. English-style
  // plural (n === 1 → _one, else _other) is sufficient for our 1 plural case.
  let resolvedKey = key;
  if (params && typeof params.n === "number") {
    const variant = params.n === 1 ? `${key}_one` : `${key}_other`;
    if (lookup(lang, variant) !== undefined || lookup("en", variant) !== undefined) {
      resolvedKey = variant;
    }
  }

  const fromActive = lookup(lang, resolvedKey);
  if (fromActive !== undefined) return interpolate(fromActive, params);

  const fromEnglish = lookup("en", resolvedKey);
  if (fromEnglish !== undefined) {
    if (lang !== "en" && typeof console !== "undefined") {
      console.warn(`[i18n] missing "${resolvedKey}" for lang="${lang}", using English fallback.`);
    }
    return interpolate(fromEnglish, params);
  }

  if (typeof console !== "undefined") {
    console.warn(`[i18n] unknown key "${resolvedKey}" (lang="${lang}").`);
  }
  return resolvedKey;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string, params?: InterpolationParams) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export { LanguageContext };

interface LanguageProviderProps {
  children: ReactNode;
  // Optional override — useful for Storybook / Playwright fixtures that need
  // to force a specific locale without touching localStorage.
  initialLang?: Lang;
}

export function LanguageProvider({ children, initialLang }: LanguageProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? detectInitialLang());

  // Persist every change so a refresh remembers the user's choice. Failures
  // are non-fatal — see localStorage caveat in `detectInitialLang`.
  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    // Reflect in <html lang=".."> so screen readers and CSS `:lang()` selectors
    // pick up the language for free.
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: string, params?: InterpolationParams) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <LanguageProvider>");
  }
  return ctx;
}
