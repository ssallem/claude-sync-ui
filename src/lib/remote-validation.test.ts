// Unit tests for the shared remote-URL validator. Two regressions guarded:
//   1. ssh:// URLs were silently rejected by InitScreen pre-v0.1.2 because
//      its inline regex omitted that scheme — the InitScreen call site and
//      the SettingsModal call site must agree on the same accept set.
//   2. Relative paths must NOT be accepted; git's "interpret relative to
//      cwd" semantics is almost never what a desktop user wants.

import { describe, it, expect } from "vitest";
import { isValidRemote, REMOTE_RE } from "./remote-validation";

describe("isValidRemote", () => {
  it("accepts https:// URLs", () => {
    expect(isValidRemote("https://github.com/me/dotclaude.git")).toBe(true);
    expect(isValidRemote("http://internal.example/repo.git")).toBe(true);
  });

  it("accepts ssh:// URLs", () => {
    expect(isValidRemote("ssh://git@example.com/repo.git")).toBe(true);
  });

  it("accepts git@host:path shorthand", () => {
    expect(isValidRemote("git@github.com:me/dotclaude.git")).toBe(true);
  });

  it("accepts Windows-style absolute paths", () => {
    expect(isValidRemote("C:\\path\\to\\repo.git")).toBe(true);
    expect(isValidRemote("D:/path/to/repo.git")).toBe(true);
  });

  it("accepts POSIX absolute paths", () => {
    expect(isValidRemote("/srv/git/repo.git")).toBe(true);
  });

  it("rejects garbage / relative / empty inputs", () => {
    expect(isValidRemote("")).toBe(false);
    expect(isValidRemote("totally-not-a-url")).toBe(false);
    expect(isValidRemote("./relative/path")).toBe(false);
    expect(isValidRemote("relative/path.git")).toBe(false);
    expect(isValidRemote("ftp://nope.example/repo")).toBe(false);
  });

  it("trims whitespace before validating", () => {
    expect(isValidRemote("   https://github.com/me/dot.git   ")).toBe(true);
    expect(isValidRemote("   \n   ")).toBe(false);
  });

  it("exports the same REMOTE_RE used by isValidRemote", () => {
    // Sanity check: the regex is exported for any caller that wants to do
    // their own match (e.g. error reporting). Keep it accessible.
    expect(REMOTE_RE.test("https://x.example/y.git")).toBe(true);
    expect(REMOTE_RE.test("nope")).toBe(false);
  });
});
