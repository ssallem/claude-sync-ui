// Vitest setup — runs before every test file.
// - Adds @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, ...).
// - Mocks browser-only APIs jsdom does not implement (matchMedia, ResizeObserver)
//   so components that touch them at render time don't blow up.

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

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
