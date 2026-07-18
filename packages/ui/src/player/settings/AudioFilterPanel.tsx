import { forwardRef, useImperativeHandle } from 'react';
import { useT } from '../../i18n';
import { IconOk } from '../icons';
import type { PanelHandle } from '../nav';
import type { AudioFilterMode } from '../types';
import { useListFocus } from '../useListFocus';
import {
  panelHint,
  panelList,
  rowCx,
  selectLabel,
  selectRow,
  selectRowOff,
  selectRowOn,
} from './panelStyle';

interface AudioFilterPanelProps {
  value: AudioFilterMode;
  onSelect: (mode: AudioFilterMode) => void;
  onBack: () => void;
}

const MODES: AudioFilterMode[] = ['off', 'standard', 'night'];

/** Volume-normalizer picker (§7): Off / Standard / Night, with a hint. Only
 * mounted when the controller reports `audioFilterSupported`. */
export const AudioFilterPanel = forwardRef<PanelHandle, AudioFilterPanelProps>(
  function AudioFilterPanel({ value, onSelect, onBack }, ref) {
    const t = useT();
    const labels: Record<AudioFilterMode, string> = {
      off: t('player.audioFilterOff'),
      standard: t('player.audioFilterStandard'),
      night: t('player.audioFilterNight'),
    };
    const pick = (i: number) => {
      const m = MODES[i];
      if (m) onSelect(m);
      onBack();
    };
    const focus = useListFocus({ count: MODES.length, onActivate: pick, onBack });
    useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

    return (
      <div>
        <div className={panelList}>
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(i)}
              onMouseEnter={focus.hover(i)}
              className={rowCx(selectRow, selectRowOn, selectRowOff, focus.index === i)}
            >
              <span className={`min-w-0 flex-1 ${selectLabel}`}>{labels[m]}</span>
              {m === value ? (
                <span className="flex flex-none text-accent">
                  <IconOk size={24} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className={panelHint}>{t('player.audioFilterHint')}</p>
      </div>
    );
  },
);
