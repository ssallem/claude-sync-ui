// Vitest configuration — kept separate from vite.config.ts so the Tauri-specific
// dev-server tuning there stays untouched. Mirrors the React plugin so JSX/TSX
// components compile under jsdom.

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
