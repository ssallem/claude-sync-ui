import { describe, it, expect } from "vitest";
import { parseSecretScanPaths } from "./stowignore";

describe("parseSecretScanPaths", () => {
  it("parses a typical Windows secret-scan payload", () => {
    const stderr = `Refusing to initialize: found 3 potential secret(s) in C:\\Users\\ssallem\\.claude:

  C:\\Users\\ssallem\\.claude\\.credentials.json:1:34 [anthropic_api_key] sk-a***AA
  C:\\Users\\ssallem\\.claude\\session-data\\2026-05-08-foo.tmp:22:44 [github_pat_classic] ghp_***Ai
  C:\\Users\\ssallem\\.claude\\plugins\\marketplaces\\x\\test.js:36:47 [aws_access_key] AKIA***LE

Error: remove or ignore the values above (e.g. via ~/.claude/.stowignore) before retrying`;
    const paths = parseSecretScanPaths(stderr);
    expect(paths).toHaveLength(3);
    expect(paths).toContain("C:\\Users\\ssallem\\.claude\\.credentials.json");
    expect(paths).toContain("C:\\Users\\ssallem\\.claude\\session-data\\2026-05-08-foo.tmp");
    expect(paths).toContain("C:\\Users\\ssallem\\.claude\\plugins\\marketplaces\\x\\test.js");
  });

  it("returns [] for empty stderr", () => {
    expect(parseSecretScanPaths("")).toEqual([]);
  });

  it("returns [] when the stderr has no secret-scan lines", () => {
    const stderr = "Some other error\nnot a secret scan at all\n";
    expect(parseSecretScanPaths(stderr)).toEqual([]);
  });

  it("parses POSIX (Unix) paths too", () => {
    const stderr = `Refusing to initialize: found 1 potential secret(s) in /home/u/.claude:

  /home/u/.claude/.credentials.json:1:1 [anthropic_api_key] sk-***
`;
    const paths = parseSecretScanPaths(stderr);
    expect(paths).toEqual(["/home/u/.claude/.credentials.json"]);
  });

  it("ignores absurdly long paths to avoid pathological regex matching", () => {
    const long = "x".repeat(600);
    const stderr = `Refusing to initialize: found 1 potential secret(s) in C:\\Users\\u\\.claude:

  C:\\Users\\u\\.claude\\${long}.tmp:1:1 [aws_access_key] AKIA***
`;
    const paths = parseSecretScanPaths(stderr);
    expect(paths).toEqual([]);
  });

  it("deduplicates repeated paths (multiple secrets in same file)", () => {
    const stderr = `Refusing to initialize: found 3 potential secret(s) in C:\\Users\\u\\.claude:

  C:\\Users\\u\\.claude\\file.js:1:1 [aws_access_key] AKIA1***
  C:\\Users\\u\\.claude\\file.js:5:1 [aws_access_key] AKIA2***
  C:\\Users\\u\\.claude\\file.js:10:1 [github_pat_classic] ghp_***
`;
    const paths = parseSecretScanPaths(stderr);
    expect(paths).toEqual(["C:\\Users\\u\\.claude\\file.js"]);
  });
});
