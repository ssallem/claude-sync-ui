// v0.2.9 — parse the sidecar's secret-scan stderr to extract absolute
// paths of files containing detected secrets, so the GUI can pass them
// to `create_smart_stowignore` for one-click recovery.
//
// stderr format (one line per finding, preceded by indentation):
//   Refusing to initialize: found N potential secret(s) in <claude_dir>:
//
//     C:\Users\you\.claude\session-data\x.tmp:42:17 [github_pat_classic] ghp_***Ai
//     /home/you/.claude/file.json:5:1 [aws_access_key] AKIA***
//
//   Error: remove or ignore the values above (e.g. via ~/.claude/.stowignore) ...
//
// Returns a deduplicated array of the absolute path portion of each line.
// Empty array when the input is not a secret-scan payload.
export function parseSecretScanPaths(stderr: string): string[] {
  // Cap at 500 chars to avoid pathological regex backtracking on malformed
  // stderr. Real claude_dir paths are well under that.
  const WIN_RE = /^\s+([A-Za-z]:\\[^:]{1,500}):\d+:\d+/;
  const NIX_RE = /^\s+(\/[^:]{1,500}):\d+:\d+/;
  const seen = new Set<string>();
  for (const line of stderr.split('\n')) {
    const m = line.match(WIN_RE) ?? line.match(NIX_RE);
    if (m) {
      seen.add(m[1]);
    }
  }
  return [...seen];
}
