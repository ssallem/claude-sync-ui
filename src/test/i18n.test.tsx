// Smoke tests for the i18n integration — verifies that LanguageProvider's
// `initialLang` flips translated strings, that setLang persists to localStorage,
// and that the runtime hot-swaps text in mounted components.
//
// v0.2.8 — Header now mounts a `useToast` consumer for the GitHub Sign out
// button, so every render here must be wrapped in <ToastProvider>. We also
// mock `@tauri-apps/api/core` so the mount-time `github_is_logged_in` IPC
// returns a deterministic `false` and the Sign out button stays hidden,
// keeping the existing button assertions stable.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { invokeMock, mapResponses } from "./invokeMock";
import Header from "../components/Header";
import { LanguageProvider, useTranslation } from "../i18n";
import { ToastProvider } from "../components/Toast";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

beforeEach(() => {
  try {
    window.localStorage.removeItem("lang");
  } catch {
    /* ignore */
  }
  mapResponses({ github_is_logged_in: async () => false });
});

describe("i18n integration", () => {
  it("renders Header in English when lang=en", () => {
    render(
      <LanguageProvider initialLang="en">
        <ToastProvider>
          <Header onSettings={() => {}} onRefresh={() => {}} />
        </ToastProvider>
      </LanguageProvider>,
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("renders Header in Korean when lang=ko", () => {
    render(
      <LanguageProvider initialLang="ko">
        <ToastProvider>
          <Header onSettings={() => {}} onRefresh={() => {}} />
        </ToastProvider>
      </LanguageProvider>,
    );
    expect(screen.getByRole("button", { name: "설정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
  });

  it("setLang('ko') persists to localStorage and hot-swaps mounted text", () => {
    // Expose the context API via a tiny harness component so the test can
    // trigger setLang() without firing through the SettingsModal UI.
    let switchTo: ((next: "ko" | "en") => void) | null = null;
    function Harness() {
      const { setLang } = useTranslation();
      switchTo = setLang;
      return <Header onSettings={() => {}} onRefresh={() => {}} />;
    }

    render(
      <LanguageProvider initialLang="en">
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </LanguageProvider>,
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();

    act(() => {
      switchTo!("ko");
    });

    // Text in the already-mounted Header should re-render in Korean.
    expect(screen.getByRole("button", { name: "설정" })).toBeInTheDocument();
    // And the choice should have been persisted for the next session.
    expect(window.localStorage.getItem("lang")).toBe("ko");
  });
});
