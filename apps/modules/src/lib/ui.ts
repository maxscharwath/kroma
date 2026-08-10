export const mb = (n?: number | null) => {
  if (!n) return '';
  if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

const PLATFORMS: Record<string, string> = {
  'aarch64-apple-darwin': 'macOS arm64',
  'x86_64-apple-darwin': 'macOS x64',
  'aarch64-unknown-linux-musl': 'Linux arm64',
  'x86_64-unknown-linux-musl': 'Linux x64',
};

/** A build target triple as the platform a reader recognises. An unmapped
 *  triple passes through; a module built for no target at all runs anywhere. */
export const platformLabel = (target?: string | null) =>
  target ? (PLATFORMS[target] ?? target) : 'Universal';

/** The first and last eight hex characters, which is how a checksum is compared
 *  by eye. The full digest is what the copy control puts on the clipboard. */
export const shortHash = (hash: string) =>
  hash.length > 20 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
