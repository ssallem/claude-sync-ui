// Vitest setup — runs before every test file.
// - Adds @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, ...).
// - Mocks browser-only APIs jsdom does not implement (matchMedia, ResizeObserver)
//   so components that touch them at render time don't blow up.
// - Pins the i18n locale to English so text-matching assertions stay stable
//   regardless of the host machine's browser locale.

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Pin i18n to English for every test — must run before any component module
// that reads localStorage at import time. Re-set per-test in case a suite
// mutates it via setLang().
try {
  window.localStorage.setItem("lang", "en");
} catch {
  /* jsdom always has localStorage; guard is defensive */
}
beforeEach(() => {
  try {
    window.localStorage.setItem("lang", "en");
  } catch {
    /* ignore */
  }
});

// React Testing Library unmounts between tests when using the auto-cleanup
// import, but we are not using the auto-import variant — explicit cleanup
// keeps DOM state isolated across files.
afterEach(() => {
  cleanup();
});

// matchMedia mock — Tailwind dark-mode utilities and a few hooks ask for it.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// ResizeObserver mock — some Tailwind/react components reach for it.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class RO {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
}
