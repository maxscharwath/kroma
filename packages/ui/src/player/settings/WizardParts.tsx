import type { ReactNode } from 'react';
import { FOCUS_RING_SM } from '../tw';

/**
 * Presentational atoms for the {@link GenerateWizard} (kept out of the wizard so
 * each file stays small). Tailwind classes only; both the web + TV builds
 * `@source` this folder so they render identically. Focus is state-driven (§15):
 * hover calls `onFocus`, a `focused` boolean toggles the ring, never CSS :hover.
 */

const CYCLE_ROW =
  'flex items-center justify-between gap-[18px] rounded-[14px] px-[22px] py-[18px] transition-[background,box-shadow] duration-150 ease-out';

/** A ◀ value ▶ cycle field (mode / language / quality / source picking). ▲▼ move
 * between fields, ◀▶ change the focused field's value. */
export function CycleField({
  label,
  value,
  focused,
  onFocus,
  onDec,
  onInc,
}: Readonly<{
  label: string;
  value: string;
  focused: boolean;
  onFocus: () => void;
  onDec: () => void;
  onInc: () => void;
}>) {
  const arrow = `flex-none text-accent text-[20px] leading-none cursor-pointer bg-transparent border-none px-1 ${
    focused ? 'opacity-100' : 'opacity-45'
  }`;
  const focusCls = `bg-[rgba(255,255,255,0.08)] ${FOCUS_RING_SM}`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter only moves D-pad focus onto the field (hover cue, §15); the real controls are the ◀ ▶ buttons.
    <div
      onMouseEnter={onFocus}
      className={`${CYCLE_ROW} ${focused ? focusCls : 'bg-[rgba(255,255,255,0.04)]'}`}
    >
      <span className="font-sans font-semibold text-[17px] text-[rgba(244,243,240,0.62)]">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="prev" onClick={onDec} className={arrow}>
          ◀
        </button>
        <span className="min-w-[180px] text-center font-sans font-bold text-[19px] text-text">
          {value}
        </span>
        <button type="button" aria-label="next" onClick={onInc} className={arrow}>
          ▶
        </button>
      </div>
    </div>
  );
}

/** The full-width wizard action button (amber when focused). */
export function ActionButton({
  label,
  focused,
  disabled,
  onFocus,
  onClick,
  children,
}: Readonly<{
  label: string;
  focused: boolean;
  disabled?: boolean;
  onFocus: () => void;
  onClick: () => void;
  children?: ReactNode;
}>) {
  let tone: string;
  if (disabled)
    tone = 'bg-[rgba(255,255,255,0.08)] text-[rgba(244,243,240,0.4)] cursor-not-allowed';
  else if (focused) tone = `bg-accent text-accent-ink ${FOCUS_RING_SM} cursor-pointer`;
  else tone = 'bg-[rgba(255,255,255,0.08)] text-text cursor-pointer';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onFocus}
      className={`mt-1 flex w-full items-center justify-center gap-2.5 rounded-[14px] py-[18px] font-sans font-bold text-[18px] border-none outline-none transition-[background,box-shadow] duration-150 ease-out ${tone}`}
    >
      {children}
      {label}
    </button>
  );
}
