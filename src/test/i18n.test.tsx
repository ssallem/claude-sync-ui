// Smoke tests for the i18n integration — verifies that LanguageProvider's
// `initialLang` flips translated strings, that setLang persists to localStorage,
// and that the runtime hot-swaps text in mounted components.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Header from "../components/Header";
import { LanguageProvider, useTranslation } from "../i18n";

beforeEach(() => {
  try {
    window.localStorage.removeItem("lang");
  } catch {
    /* ignore */
  }
});

describe("i18n integration", () => {
  it("renders Header in English when lang=en", () => {
    render(
      <LanguageProvider initialLang="en">
        <Header onSettings={() => {}} onRefresh={() => {}} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("renders Header in Korean when lang=ko", () => {
    render(
      <LanguageProvider initialLang="ko">
        <Header onSettings={() => {}} onRefresh={() => {}} />
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
        <Harness />
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
