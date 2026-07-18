import type { ReactNode } from 'react';
import { IconForward } from '../icons';
import { menuLabel, menuRow, menuRowOff, menuRowOn, menuValue, rowCx } from './panelStyle';

/**
 * A settings main-menu row: leading icon + label (+ current value), then a chevron
 * (navigates into a sub-view) or an on/off switch (Loop, Statistics). The whole row
 * is the focusable button; hover moves D-pad focus, OK/click activates (§15).
 */
export function MenuRow({
  icon,
  label,
  value,
  toggle,
  on,
  focused,
  onActivate,
  onFocus,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  toggle?: boolean;
  on?: boolean;
  focused: boolean;
  onActivate: () => void;
  onFocus: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={onFocus}
      aria-pressed={toggle ? Boolean(on) : undefined}
      className={rowCx(menuRow, menuRowOn, menuRowOff, focused)}
    >
      <span className="flex flex-none text-text">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block ${menuLabel}`}>{label}</span>
        {!toggle && value != null ? <span className={`block ${menuValue}`}>{value}</span> : null}
      </span>
      {toggle ? <Switch on={Boolean(on)} /> : <Chevron />}
    </button>
  );
}

/** The 48x28 track + 22px knob switch used by the Loop / Statistics rows. */
function Switch({ on }: Readonly<{ on: boolean }>) {
  return (
    <span
      className={`relative flex-none h-7 w-12 rounded-full transition-[background] duration-200 ease-out ${
        on ? 'bg-accent' : 'bg-[rgba(255,255,255,0.2)]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-[left] duration-200 ${
          on ? 'left-[23px]' : 'left-[3px]'
        }`}
      />
    </span>
  );
}

/** The trailing chevron shown on rows that open a sub-view. */
function Chevron() {
  return (
    <span className="flex flex-none text-text">
      <IconForward size={23} stroke={2.2} />
    </span>
  );
}
