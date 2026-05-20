// Header — v0.2.8 GitHub logout button visibility + click behavior.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { invokeMock, mapResponses } from "../test/invokeMock";
import Header from "./Header";
import { ToastProvider } from "./Toast";
import { LanguageProvider } from "../i18n";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

const renderHeader = (onSettings = vi.fn(), onRefresh = vi.fn()) =>
  rtlRender(
    <LanguageProvider initialLang="en">
      <ToastProvider>
        <Header onSettings={onSettings} onRefresh={onRefresh} />
      </ToastProvider>
    </LanguageProvider>,
  );

describe("Header — v0.2.8 GitHub logout button", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("shows the Sign out button when a GitHub token is present", async () => {
    mapResponses({ github_is_logged_in: async () => true });
    renderHeader();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Sign out/i }),
      ).toBeInTheDocument();
    });
  });

  it("hides the Sign out button when no GitHub token is present", async () => {
    mapResponses({ github_is_logged_in: async () => false });
    renderHeader();

    // Wait for the mount-time check to settle by asserting Settings is visible
    // (always present) and then confirming Sign out is absent.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Settings/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Sign out/i }),
    ).not.toBeInTheDocument();
  });

  it("calls github_logout and shows success toast on click", async () => {
    mapResponses({
      github_is_logged_in: async () => true,
      github_logout: async () => undefined,
    });
    renderHeader();

    const signOutBtn = await screen.findByRole("button", { name: /Sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      const calls = invokeMock.mock.calls.filter((c) => c[0] === "github_logout");
      expect(calls.length).toBe(1);
    });
    // Success toast appears.
    await waitFor(() => {
      expect(screen.getByText(/Signed out of GitHub/i)).toBeInTheDocument();
    });
  });
});
