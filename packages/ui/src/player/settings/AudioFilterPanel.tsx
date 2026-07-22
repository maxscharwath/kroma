import { forwardRef, useImperativeHandle } from 'react';
import { useT } from '../../i18n';
import { Txt } from '../../primitives/Text';
import { Box } from '../../system/Box';
import type { PanelHandle } from '../nav';
import type { AudioFilterMode } from '../types';
import { useListFocus } from '../useListFocus';
import { panelHint, panelList } from './panelStyle';
import { SelectRow } from './SelectRow';

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
      <Box>
        <Box style={panelList}>
          {MODES.map((m, i) => (
            <SelectRow
              key={m}
              label={labels[m]}
              selected={m === value}
              focused={focus.index === i}
              onActivate={() => pick(i)}
              onFocus={focus.hover(i)}
            />
          ))}
        </Box>
        <Txt style={panelHint}>{t('player.audioFilterHint')}</Txt>
      </Box>
    );
  },
);
