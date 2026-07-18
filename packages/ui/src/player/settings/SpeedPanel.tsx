import { forwardRef, useImperativeHandle } from 'react';
import { useT } from '../../i18n';
import { IconOk } from '../icons';
import type { PanelHandle } from '../nav';
import { useListFocus } from '../useListFocus';
import { panelList, rowCx, selectLabel, selectRow, selectRowOff, selectRowOn } from './panelStyle';

/** The offered playback rates (§5). */
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

interface SpeedPanelProps {
  rate: number;
  onSelect: (rate: number) => void;
  onBack: () => void;
}

/** Playback-speed picker (§5). `1` reads as "Normal"; others as "1.25×". */
export const SpeedPanel = forwardRef<PanelHandle, SpeedPanelProps>(function SpeedPanel(
  { rate, onSelect, onBack },
  ref,
) {
  const t = useT();
  const pick = (i: number) => {
    const r = RATES[i];
    if (r != null) onSelect(r);
    onBack();
  };
  const focus = useListFocus({ count: RATES.length, onActivate: pick, onBack });
  useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

  return (
    <div className={panelList}>
      {RATES.map((r, i) => (
        <button
          key={r}
          type="button"
          onClick={() => pick(i)}
          onMouseEnter={focus.hover(i)}
          className={rowCx(selectRow, selectRowOn, selectRowOff, focus.index === i)}
        >
          <span className={`min-w-0 flex-1 ${selectLabel}`}>
            {r === 1 ? t('player.normalSpeed') : `${r}×`}
          </span>
          {r === rate ? (
            <span className="flex flex-none text-accent">
              <IconOk size={24} />
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
});
