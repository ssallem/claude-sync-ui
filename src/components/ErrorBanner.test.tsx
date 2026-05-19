// Unit tests for ErrorBanner v0.2.3 hotfix.
//
// Covers:
//   1. Short messages render verbatim — no toggle, no chrome regressions.
//   2. Long messages collapse to a preview + expose a Show full / Show less
//      toggle. Expanding restores the full body.
//   3. Secret-scan refusals surface a Create .stowignore action button only
//      when onCreateStowignore is wired; clicking it invokes the callback.
//   4. Dismiss button is always reachable, even for the worst-case 3,000+
//      character secret-scan payload (the v0.2.2 dogfood bug).
//
// We avoid mocking i18n — LanguageProvider initialLang="en" gives the same
// stable English strings as the rest of the test suite.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ErrorBanner, { isSecretScanError } from "./ErrorBanner";
import { LanguageProvider } from "../i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);
}

// Build the exact shape of payload the sidecar emits — 44 file:line
// findings + the recommended-fix tail. Keeping it close to the real bytes
// lets the heuristics earn their keep.
function buildSecretScanPayload(): string {
  const header =
    "Refusing to initialize: found 44 potential secret(s) in C:\\Users\\mellass\\.claude:";
  const findings = Array.from({ length: 44 }, (_, i) =>
    `C:\\Users\\mellass\\.claude\\file-history\\hash${i}@v1:2:17 [google_api_key] AIza***Nw`,
  ).join("\n");
  const tail =
    "Error: remove or ignore the values above (e.g. via ~/.claude/.stowignore) before retrying";
  return [header, findings, tail].join("\n");
}

describe("ErrorBanner — short messages", () => {
  it("renders short messages verbatim with no collapse toggle", () => {
    renderWithI18n(<ErrorBanner message="fatal: bad credentials" />);

    expect(screen.getByText(/fatal: bad credentials/)).toBeInTheDocument();
    // No "Show full" or "Show less" toggle — the message fits.
    expect(screen.queryByRole("button", { name: /Show full message/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Show less/i })).toBeNull();
  });

  it("does not show the stowignore action for non-secret-scan errors", () => {
    const handler = vi.fn();
    renderWithI18n(
      <ErrorBanner message="some boring git error" onCreateStowignore={handler} />,
    );
    expect(
      screen.queryByRole("button", { name: /Create \.stowignore/i }),
    ).toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("ErrorBanner — long messages collapse", () => {
  it("folds a 3kB+ secret-scan payload to a preview + Show full toggle", () => {
    const long = buildSecretScanPayload();
    expect(long.length).toBeGreaterThan(200); // sanity — heuristic must trip

    renderWithI18n(<ErrorBanner message={long} onDismiss={() => {}} />);

    // The preview shows the header line; the bulky finding tail should be
    // hidden until the user expands.
    expect(screen.getByText(/Refusing to initialize: found/)).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Show full message/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Expanding flips the label + aria state and reveals the tail.
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: /Show less/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/remove or ignore the values above/)).toBeInTheDocument();
  });
});

describe("ErrorBanner — secret-scan recovery action", () => {
  it("shows the Create .stowignore action only on detected secret-scan refusals", () => {
    const handler = vi.fn(async () => undefined);
    renderWithI18n(
      <ErrorBanner
        message={buildSecretScanPayload()}
        onCreateStowignore={handler}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Create \.stowignore/i }),
    ).toBeInTheDocument();
  });

  it("invokes onCreateStowignore when clicked", async () => {
    const handler = vi.fn(async () => undefined);
    renderWithI18n(
      <ErrorBanner
        message={buildSecretScanPayload()}
        onCreateStowignore={handler}
      />,
    );
    const btn = screen.getByRole("button", { name: /Create \.stowignore/i });
    await act(async () => {
      btn.click();
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("hides the action button when onCreateStowignore is absent", () => {
    renderWithI18n(<ErrorBanner message={buildSecretScanPayload()} />);
    expect(
      screen.queryByRole("button", { name: /Create \.stowignore/i }),
    ).toBeNull();
  });
});

describe("ErrorBanner — dismiss reachability", () => {
  it("renders an always-visible dismiss button with a descriptive aria-label", () => {
    const onDismiss = vi.fn();
    renderWithI18n(
      <ErrorBanner message={buildSecretScanPayload()} onDismiss={onDismiss} />,
    );
    const dismiss = screen.getByRole("button", { name: /Dismiss error/i });
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorBanner — isSecretScanError heuristic", () => {
  // The detection is the load-bearing piece — keep it explicit so a wording
  // tweak in the sidecar doesn't silently turn the action button off.
  it.each([
    ["Refusing to initialize: found 44 potential secret(s)", true],
    ["refusing to initialize: found 1 potential secret(s)", true],
    ["Found 3 potential secret(s) in scan", true],
    ["fatal: not a git repository", false],
    ["network unreachable", false],
    ["", false],
  ])("isSecretScanError(%j) -> %s", (input, expected) => {
    expect(isSecretScanError(input)).toBe(expected);
  });
});
