import { FOCUS_RING_SM } from '../tw';

/**
 * Shared Tailwind class-string atoms for the settings sub-panels, so every list,
 * row, hint and value row looks identical across Quality / Audio / Subtitles /
 * Speed / Appearance. The web + TV Tailwind builds both `@source` this folder, so
 * these are real classes (no inline style, except runtime-dynamic values).
 *
 * Focus is STATE-driven (hover moves focus exactly like the D-pad, §15): a row
 * toggles `*_ON` / `*_OFF` on a boolean, never via CSS :hover / :focus.
 */

/** Vertical stack of selectable rows (design gap: 10px). */
export const panelList = 'flex flex-col gap-2.5';

/** A selectable sub-list row (Quality / Audio / Subtitles / Speed): icon-free,
 * label (+ optional sub-line) on the left, an accent check when active. */
export const selectRow =
  'flex w-full items-center gap-4 rounded-[14px] px-[22px] py-[18px] text-left cursor-pointer outline-none border-none transition-[background,box-shadow] duration-150 ease-out';
export const selectRowOn = `bg-[rgba(255,255,255,0.1)] ${FOCUS_RING_SM}`;
export const selectRowOff = 'bg-transparent';
export const selectLabel = 'font-sans font-semibold text-[20px] text-text leading-tight';
export const selectSub = 'font-sans font-medium text-[14px] text-[rgba(244,243,240,0.5)] mt-0.5';

/** A main-menu row: leading icon, bold label + current value, trailing control. */
export const menuRow =
  'flex w-full items-center gap-[18px] rounded-[14px] px-[22px] py-[18px] text-left cursor-pointer outline-none border-none transition-[background,box-shadow] duration-150 ease-out';
export const menuRowOn = `bg-[rgba(255,255,255,0.1)] ${FOCUS_RING_SM}`;
export const menuRowOff = 'bg-transparent';
export const menuLabel = 'font-sans font-bold text-[21px] text-text leading-tight';
export const menuValue = 'font-sans font-medium text-[15px] text-[rgba(244,243,240,0.5)] mt-0.5';

/** An appearance / wizard value row (label + arrows header, control below). */
export const valueRow =
  'rounded-[14px] px-[22px] py-4 transition-[background,box-shadow] duration-150 ease-out';
export const valueRowOn = `bg-[rgba(255,255,255,0.08)] ${FOCUS_RING_SM}`;
export const valueRowOff = 'bg-transparent';
export const valueLabel = 'font-sans font-bold text-[15px] text-text';

/** A muted hint paragraph under a control group. */
export const panelHint =
  'mt-3 mx-0.5 font-sans text-[15px] font-medium leading-relaxed text-[rgba(244,243,240,0.5)]';

/** Empty-state line (no audio tracks / no source subtitle). */
export const panelEmpty = 'px-0.5 py-1 font-sans text-[15px] text-[rgba(244,243,240,0.45)]';

/** Compose a row's base + focus/idle classes on the `focused` boolean. */
export const rowCx = (base: string, on: string, off: string, focused: boolean): string =>
  `${base} ${focused ? on : off}`;
