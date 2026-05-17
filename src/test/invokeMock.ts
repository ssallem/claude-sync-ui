// Shared helper for tests that need to fake the Tauri invoke bridge.
// Vitest hoists `vi.mock` to the top of the test file regardless of where it
// appears, so we expose a singleton `invokeMock` plus a small `mapResponses`
// helper for per-command routing.
//
// Usage:
//   import { invokeMock, mapResponses } from "../test/invokeMock";
//   vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
//   beforeEach(() => mapResponses({ status: async () => ({ ... }) }));

import { vi } from "vitest";

export type InvokeHandler = (args?: Record<string, unknown>) => unknown | Promise<unknown>;

let routes: Record<string, InvokeHandler> = {};

export const invokeMock = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
  const handler = routes[cmd];
  if (!handler) {
    throw new Error(`invokeMock: no route registered for command "${cmd}"`);
  }
  return handler(args);
});

export function mapResponses(next: Record<string, InvokeHandler>): void {
  routes = next;
  invokeMock.mockClear();
}

export function resetInvokeMock(): void {
  routes = {};
  invokeMock.mockReset();
}
