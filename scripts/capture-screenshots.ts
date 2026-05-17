// Auto-capture README screenshots from the React UI running in mock mode.
//
// Why mock mode: spinning up the full Tauri runtime in CI would mean shipping a
// Linux/macOS build of `claude-sync` plus an Xvfb display server just for screenshots.
// Instead, we serve the React frontend via `vite dev` and stub `window.__TAURI_INTERNALS__`
// (see `src/main-mock.tsx`) so `invoke()` resolves to canned responses. The screenshots
// therefore show the UI exactly as it renders inside the Tauri window MINUS the native
// Windows title bar — the README disclaimer makes this honest.
//
// Browser: uses the system Microsoft Edge (`channel: "msedge"`) so we don't trigger a
// ~170MB Playwright Chromium download. On a machine without Edge, set
// PLAYWRIGHT_CHANNEL=chrome (or remove the channel to fall back to Playwright Chromium).

import { chromium, type Browser, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const VIEWPORT = { width: 1200, height: 720 } as const;
const DEV_PORT = Number(process.env.MOCK_DEV_PORT ?? 5173);
const DEV_HOST = `http://localhost:${DEV_PORT}`;
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const OUT_DIR = resolve(process.cwd(), "docs", "screenshots");
const READY_TIMEOUT_MS = 30_000;
const RENDER_SETTLE_MS = 1000;

interface Shot {
  name: string;
  scenario: "init" | "main" | "conflict";
}

const SHOTS: Shot[] = [
  { name: "01-init.png", scenario: "init" },
  { name: "02-main.png", scenario: "main" },
  { name: "03-conflict.png", scenario: "conflict" },
];

async function waitForDevServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite dev server did not become ready at ${url}: ${String(lastError)}`);
}

function spawnDevServer(): ChildProcess {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  // Force the dev server onto our chosen port (default 5173) by overriding the Tauri
  // default of 1420. On Windows we need `shell: true` so the .cmd shim is resolved.
  const child = spawn(
    npm,
    ["run", "dev", "--", "--port", String(DEV_PORT), "--strictPort"],
    { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" },
  );
  child.stdout?.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[vite!] ${chunk}`));
  return child;
}

async function capture(page: Page, shot: Shot): Promise<void> {
  const url = `${DEV_HOST}/index-mock.html?scenario=${shot.scenario}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(RENDER_SETTLE_MS);
  const outPath = resolve(OUT_DIR, shot.name);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  captured ${shot.name} -> ${outPath}`);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Starting Vite dev server on port ${DEV_PORT}...`);
  const dev = spawnDevServer();
  let browser: Browser | null = null;
  const cleanup = () => {
    if (browser) browser.close().catch(() => {});
    if (!dev.killed) dev.kill();
  };
  process.on("SIGINT", () => { cleanup(); process.exit(130); });
  process.on("SIGTERM", () => { cleanup(); process.exit(143); });

  try {
    await waitForDevServer(`${DEV_HOST}/index-mock.html?scenario=main`, READY_TIMEOUT_MS);
    console.log("Dev server ready. Launching browser...");

    browser = await chromium.launch({ channel: CHANNEL, headless: true });
    // deviceScaleFactor: 2 doubles the pixel density so the PNGs are crisp on
    // hi-DPI README viewers (GitHub renders at the source resolution).
    const context = await browser.newContext({
      viewport: { ...VIEWPORT },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const shot of SHOTS) {
      await capture(page, shot);
    }
    await context.close();
    console.log("All screenshots captured successfully.");
  } finally {
    cleanup();
  }
}

main().catch((e) => {
  console.error("Screenshot capture failed:", e);
  process.exit(1);
});
