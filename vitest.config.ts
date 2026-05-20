// Vitest configuration — kept separate from vite.config.ts so the Tauri-specific
// dev-server tuning there stays untouched. Mirrors the React plugin so JSX/TSX
// components compile under jsdom.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
  plugins: [react()],
  // v0.2.10 — mirror the `define` from vite.config.ts so __APP_VERSION__ is
  // resolved when components render under jsdom in vitest.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
