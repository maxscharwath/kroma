// Naming a device from a User-Agent string.
//
// Shared rather than feature-local because three places need the same answer:
// the sessions list (whose device is this?), passkey enrolment (what do we call
// the key we just made?), and push subscription (which browser is subscribed?).
// Table-driven so adding a browser is a row, not another branch.

export type DeviceKind = 'tv' | 'mobile' | 'desktop';

/** First matching label for `s` from `[regex, label]` pairs, or `null`. */
function match(s: string, table: [RegExp, string][]): string | null {
  for (const [re, label] of table) if (re.test(s)) return label;
  return null;
}

const KINDS: [RegExp, DeviceKind][] = [
  [/tv|tizen|web0?os|smart-tv|crkey/, 'tv'],
  [/mobi|iphone|ipad|ipod|android/, 'mobile'],
];
const BROWSERS: [RegExp, string][] = [
  [/firefox|fxios/, 'Firefox'],
  [/edg/, 'Edge'],
  [/chrome|crios|crmo/, 'Chrome'],
  [/safari/, 'Safari'],
];
const OSES: [RegExp, string][] = [
  [/windows/, 'Windows'],
  [/iphone|ipad|ipod/, 'iOS'],
  [/mac os x|macintosh/, 'macOS'],
  [/android/, 'Android'],
  [/cros/, 'ChromeOS'],
  [/linux/, 'Linux'],
];

/** Best-effort device label + kind from a User-Agent string. Falls back to a
 * generic label when the UA is missing or unrecognised. */
export function deviceInfo(
  ua: string | null | undefined,
  unknown: string,
): { label: string; kind: DeviceKind } {
  const s = (ua ?? '').toLowerCase();
  if (!s) return { label: unknown, kind: 'desktop' };
  const kind = (match(s, KINDS as [RegExp, string][]) as DeviceKind | null) ?? 'desktop';
  const label = [match(s, BROWSERS), match(s, OSES)].filter(Boolean).join(' · ') || unknown;
  return { label, kind };
}
