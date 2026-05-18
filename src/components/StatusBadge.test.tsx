// Visual smoke tests for StatusBadge — asserts that each kind renders the
// expected single-letter label *and* keeps the colour-class contract the
// rest of the UI depends on (FileTree groups, ActionBar conflict tint).

import React from "react";
import { describe, it, expect } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";
import { LanguageProvider } from "../i18n";

// Wrap renders so StatusBadge's useTranslation hook has a provider; pin to
// English for stable title-attribute assertions.
const render = (ui: React.ReactElement) =>
  rtlRender(<LanguageProvider initialLang="en">{ui}</LanguageProvider>);

interface Case {
  kind: "M" | "A" | "D" | "?" | "!" | "synced";
  label: string;
  colourSubstring: string; // partial of the Tailwind palette name, before any /opacity suffix
}

const CASES: Case[] = [
  { kind: "M", label: "M", colourSubstring: "bg-yellow" },
  { kind: "A", label: "A", colourSubstring: "bg-green" },
  { kind: "D", label: "D", colourSubstring: "bg-gray" },
  { kind: "?", label: "?", colourSubstring: "bg-blue" },
  { kind: "!", label: "!", colourSubstring: "bg-red" },
  { kind: "synced", label: "S", colourSubstring: "bg-slate" },
];

describe("StatusBadge", () => {
  for (const c of CASES) {
    it(`renders ${c.kind} with label "${c.label}" and includes "${c.colourSubstring}" class`, () => {
      const { container } = render(<StatusBadge kind={c.kind} />);
      // Label is the only text node in the badge.
      expect(screen.getByText(c.label)).toBeInTheDocument();
      // Pull the actual root <span> and inspect its class list.
      const span = container.querySelector("span");
      expect(span).not.toBeNull();
      expect(span!.className).toContain(c.colourSubstring);
    });
  }

  it("falls back to a slate badge for unknown kinds and uses the first letter as label", () => {
    const { container } = render(<StatusBadge kind="renamed" />);
    expect(screen.getByText("r")).toBeInTheDocument();
    expect(container.querySelector("span")!.className).toContain("bg-slate");
  });
});
