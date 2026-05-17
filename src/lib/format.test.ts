// Unit tests for formatAgo — covers each branch of the bucket ladder so a
// regression to the boundaries (30s / 60s / 60min / 24h) is caught immediately.

import { describe, it, expect } from "vitest";
import { formatAgo } from "./format";

// Fix "now" so the deltas stay deterministic.
const NOW = 1_700_000_000_000;

describe("formatAgo", () => {
  it("returns 'never' when timestamp is null", () => {
    expect(formatAgo(null, NOW)).toBe("never");
  });

  it("returns 'Just now' for deltas under 30 seconds", () => {
    expect(formatAgo(NOW - 5 * 1000, NOW)).toBe("Just now");
  });

  it("returns 'N sec ago' for deltas between 30s and 60s", () => {
    expect(formatAgo(NOW - 30 * 1000, NOW)).toBe("30 sec ago");
    expect(formatAgo(NOW - 59 * 1000, NOW)).toBe("59 sec ago");
  });

  it("returns 'N min ago' for deltas between 1m and 60m", () => {
    expect(formatAgo(NOW - 70 * 1000, NOW)).toBe("1 min ago");
    expect(formatAgo(NOW - 59 * 60 * 1000, NOW)).toBe("59 min ago");
  });

  it("returns 'N hr ago' for deltas between 1h and 24h", () => {
    expect(formatAgo(NOW - 3700 * 1000, NOW)).toBe("1 hr ago");
    expect(formatAgo(NOW - 23 * 3600 * 1000, NOW)).toBe("23 hr ago");
  });

  it("returns 'N day(s) ago' for deltas of 1 day or more, pluralising correctly", () => {
    expect(formatAgo(NOW - 90_000 * 1000, NOW)).toBe("1 day ago");
    expect(formatAgo(NOW - 2 * 24 * 3600 * 1000, NOW)).toBe("2 days ago");
  });

  it("clamps negative deltas (future timestamps) to 'Just now'", () => {
    expect(formatAgo(NOW + 5000, NOW)).toBe("Just now");
  });
});
