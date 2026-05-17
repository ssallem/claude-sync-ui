// Lightweight relative-time formatter used by RemoteBar/StatusBar.
// Day 5 may swap this for a richer library; for now we render a single coarse bucket.

export function formatAgo(timestamp: number | null, now: number = Date.now()): string {
  if (timestamp === null) {
    return "never";
  }
  const deltaMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
