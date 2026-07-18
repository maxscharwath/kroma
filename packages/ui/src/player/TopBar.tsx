import { useT } from '../i18n';
import { IconBack } from './icons';
import { FOCUS_RING } from './tw';

/**
 * Player top chrome (§ top chrome): a gradient bar holding the round back
 * button, the title + subtitle, and an optional warning pill on the right
 * (e.g. a transcode / unsupported-codec notice). Rendered over the video, so
 * the bar itself is click-through and only the back button captures the pointer.
 */
export interface TopBarProps {
  title: string;
  subtitle?: string;
  /** Pre-translated warning message, or null to hide the pill. */
  warn?: string | null;
  onBack: () => void;
  /** Whether the nav machine currently rests on the back button. */
  backFocused?: boolean;
}

export function TopBar({ title, subtitle, warn, onBack, backFocused }: Readonly<TopBarProps>) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-[18px] bg-[linear-gradient(180deg,rgba(0,0,0,0.65),transparent)] px-[34px] py-[26px]">
      <button
        type="button"
        aria-label={t('player.back')}
        onClick={onBack}
        className={`pointer-events-auto flex h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.1)] text-white outline-none transition-[transform,box-shadow] duration-150 ease-out ${backFocused ? FOCUS_RING : ''}`}
      >
        <IconBack size={20} />
      </button>
      <div className="min-w-0">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap font-display text-[19px] font-bold text-white">
          {title}
        </div>
        {subtitle ? (
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-sans text-[13px] font-medium text-[rgba(244,243,240,0.6)]">
            {subtitle}
          </div>
        ) : null}
      </div>
      {warn ? (
        <span className="ml-auto flex-none whitespace-nowrap rounded-full bg-accent-soft px-3.5 py-2 font-sans text-[13px] font-semibold text-accent">
          {warn}
        </span>
      ) : null}
    </div>
  );
}
