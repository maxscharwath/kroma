export const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const;

export const PAGE = {
  maxWidth: 1080,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',
} as const;

export const mb = (n?: number | null) => {
  if (!n) return '';
  if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

/** `x86_64-unknown-linux-musl` is the whole triple; the page only needs the arch. */
export const shortTarget = (t: string) =>
  t.replace('-unknown-linux-musl', '').replace('-apple-darwin', '');
