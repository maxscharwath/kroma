// Shared 10-foot UI primitives for the redesigned TV app: brand mark, profile
// avatars, the radial auth backdrop, a wall clock, and the two remote-driven
// on-screen inputs (a full keyboard for server URLs / search, a numeric keypad
// for PINs). Everything interactive carries `data-focus` so the spatial focus
// nav (useFocusNav) reaches it and OK activates via the native click.

import { normalizeServerUrl } from '@luma/core';
import { IconBackspace, IconSpace, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

// Vivid avatar gradients — the same palette across web / TV profile pickers.
export const AVATAR_GRADS = [
  'linear-gradient(135deg,#F4B642,#E8743B)',
  'linear-gradient(135deg,#3BC9DB,#3B82F6)',
  'linear-gradient(135deg,#A855F7,#6366F1)',
  'linear-gradient(135deg,#F472B6,#EC4899)',
  'linear-gradient(135deg,#34D399,#10B981)',
];

/** Deterministic avatar gradient for a seed (user id), so a profile keeps its
 * colour everywhere. */
export function gradFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADS[h % AVATAR_GRADS.length] as string;
}

/** Hostname of a server URL, or `null` when it can't be parsed. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Resolve a (possibly server-relative) avatar URL against its own server. */
export function artUrl(serverUrl: string, url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${normalizeServerUrl(serverUrl)}${url.startsWith('/') ? url : `/${url}`}`;
}

/** 1–2 letter initials for an avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** The LUMA brand mark — concentric amber rings + the wordmark. */
export function LumaMark({ size = 30 }: Readonly<{ size?: number }>) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="13" stroke="#F4B642" strokeWidth="2.4" />
        <circle cx="16" cy="16" r="4.5" fill="#F4B642" />
      </svg>
      <span
        className="font-display font-extrabold leading-none tracking-[0.16em]"
        style={{ fontSize: Math.round(size * 0.82) }}
      >
        LUMA
      </span>
    </div>
  );
}

/** Live wall clock ("20:15") — 24-hour, updated each minute. */
export function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Rounded-square profile avatar — uploaded photo when present, else a
 * deterministic gradient with the user's initials. Optional amber lock badge for
 * PIN-protected profiles. */
export function ProfileAvatar({
  name,
  seed,
  size,
  src,
  locked = false,
  radius,
}: Readonly<{
  name: string;
  seed: string;
  size: number;
  src?: string | null;
  locked?: boolean;
  radius?: number;
}>) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src) && !failed;
  const r = radius ?? Math.round(size * 0.16);
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden font-display font-bold text-white/95"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: gradFor(seed),
        fontSize: Math.round(size * 0.38),
        boxShadow: '0 16px 40px rgba(0,0,0,.45)',
      }}
    >
      {showImg ? (
        <img
          src={src ?? undefined}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
      {locked ? (
        <span
          className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-[rgba(10,10,12,0.8)] text-accent"
          style={{ width: Math.max(24, size * 0.2), height: Math.max(24, size * 0.2) }}
        >
          <LockGlyph size={Math.max(14, size * 0.11)} />
        </span>
      ) : null}
    </div>
  );
}

/** Padlock glyph (lock badge / PIN headers). */
export function LockGlyph({ size = 16 }: Readonly<{ size?: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" />
      <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
      <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

/** The shared centred backdrop for the auth / connect / pin screens. Scrolling
 * lives on the outer element and the content centres in an inner `min-h-full`
 * wrapper — so it sits centred when it fits but scrolls from the top (never
 * clipping the title) when the content is taller than the screen. */
export function AuthScreen({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      className="scrollbar-none fixed inset-0 z-10 overflow-y-auto animate-[tv-fade-in_0.45s_ease]"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 68%)' }}
    >
      <div className="flex min-h-full flex-col items-center justify-center px-10 py-12 text-center">
        {children}
      </div>
    </div>
  );
}

// ----- on-screen keyboard -----------------------------------------------------

const KB_KEY =
  'flex cursor-pointer items-center justify-center rounded-xl bg-[rgba(255,255,255,0.05)] font-sans font-bold text-text transition-transform focus:scale-[1.08] focus:bg-[rgba(244,182,66,0.18)] focus:text-accent';

/** A remote-driven on-screen keyboard. The caller owns the text value; each key
 * mutates it through `onChange`, and the special keys (space / delete / clear /
 * submit / close) call the matching handler. `layout` swaps between the
 * server-URL keyboard and the search keyboard (which has its own dedicated
 * layout, {@link SearchKeyboard}). */
export function OnScreenKeyboard({
  value,
  onChange,
  onSubmit,
  onClose,
  layout = 'search',
  submitLabel,
}: Readonly<{
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  onClose?: () => void;
  layout?: 'url' | 'search';
  submitLabel?: string;
}>) {
  if (layout === 'search')
    return <SearchKeyboard value={value} onChange={onChange} onClose={onClose} />;

  const press = (k: string) => {
    if (k === '⌫') onChange(value.slice(0, -1));
    else onChange(value + k);
  };
  return (
    <div className="flex flex-col gap-3">
      {URL_ROWS.map((row) => (
        <div key={row.join('')} className="flex gap-3">
          {row.map((k) => (
            <button
              key={k}
              data-focus=""
              type="button"
              onClick={() => press(k)}
              className={`${KB_KEY} h-13 flex-1 text-[20px]`}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-3">
        <button
          data-focus=""
          type="button"
          onClick={() => onChange('')}
          className={`${KB_KEY} h-13 flex-[2] text-[16px]`}
        >
          ⌧
        </button>
        <button
          data-focus=""
          type="button"
          onClick={() => onChange(`${value}.`)}
          className={`${KB_KEY} h-13 flex-1 text-[20px]`}
        >
          .
        </button>
        {onSubmit ? (
          <button
            data-focus=""
            type="button"
            onClick={onSubmit}
            className="flex h-13 flex-[3] cursor-pointer items-center justify-center rounded-xl bg-accent font-sans text-[17px] font-bold text-accent-ink transition-transform focus:scale-[1.06]"
          >
            {submitLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const URL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
  ['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'],
  ['u', 'v', 'w', 'x', 'y', 'z', '-', ':', '/', '⌫'],
];

// ----- search keyboard --------------------------------------------------------

const SEARCH_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SEARCH_LETTER_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X'],
];

/** The search on-screen keyboard, matching the LUMA design: a 1–0 digit row, the
 * uppercase alphabet in rows of six, and a final row pairing Y / Z with space,
 * backspace and a close key. Letters insert lowercase (search is
 * case-insensitive); the focused key fills solid amber for a strong 10-foot cue. */
function SearchKeyboard({
  value,
  onChange,
  onClose,
}: Readonly<{ value: string; onChange: (next: string) => void; onClose?: () => void }>) {
  const cell =
    'flex h-14 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[rgba(255,255,255,0.05)] font-sans text-[22px] font-bold text-text transition-transform focus:scale-[1.08] focus:bg-accent focus:text-accent-ink';
  // A render helper (not a nested component) so the <button> element type stays
  // stable across the per-keypress re-render and focus is never lost.
  const key = (id: string, label: ReactNode, onPress: () => void) => (
    <button key={id} data-focus="" type="button" onClick={onPress} className={cell}>
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {SEARCH_DIGITS.map((d) => key(d, d, () => onChange(value + d)))}
      </div>
      {SEARCH_LETTER_ROWS.map((row) => (
        <div key={row.join('')} className="flex gap-3">
          {row.map((l) => key(l, l, () => onChange(value + l.toLowerCase())))}
        </div>
      ))}
      <div className="flex gap-3">
        {key('Y', 'Y', () => onChange(`${value}y`))}
        {key('Z', 'Z', () => onChange(`${value}z`))}
        {key('space', <IconSpace size={28} stroke={1.8} />, () => onChange(`${value} `))}
        {key('delete', <IconBackspace size={26} stroke={1.8} />, () =>
          onChange(value.slice(0, -1)),
        )}
        {key('close', <IconX size={24} stroke={2} />, () => onClose?.())}
      </div>
    </div>
  );
}

// ----- numeric keypad (PIN) ---------------------------------------------------

/** A D-pad numeric keypad for the PIN screen: 1–9, then ⌫ / 0 / OK. */
export function Keypad({
  onDigit,
  onDelete,
  onSubmit,
}: Readonly<{
  onDigit: (d: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}>) {
  const cell =
    'flex h-18 w-22 cursor-pointer items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.06)] font-sans text-[28px] font-bold text-text transition-transform focus:scale-[1.08] focus:bg-[rgba(244,182,66,0.18)] focus:text-accent';
  return (
    <div className="flex flex-col gap-3.25">
      {[
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ].map((row) => (
        <div key={row.join('')} className="flex gap-3.25">
          {row.map((d) => (
            <button key={d} data-focus="" type="button" className={cell} onClick={() => onDigit(d)}>
              {d}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-3.25">
        <button data-focus="" type="button" className={`${cell} text-[22px]`} onClick={onDelete}>
          ⌫
        </button>
        <button data-focus="" type="button" className={cell} onClick={() => onDigit('0')}>
          0
        </button>
        <button
          data-focus=""
          type="button"
          className="flex h-18 w-22 cursor-pointer items-center justify-center rounded-2xl bg-accent font-sans text-[18px] font-bold text-accent-ink transition-transform focus:scale-[1.08]"
          onClick={onSubmit}
        >
          OK
        </button>
      </div>
    </div>
  );
}
