import type { AudioTrack } from '@kroma/core';
import { channelLabel, langName } from '@kroma/core';
import { forwardRef, useImperativeHandle } from 'react';
import { useT } from '../../i18n';
import { IconOk } from '../icons';
import type { PanelHandle } from '../nav';
import { useListFocus } from '../useListFocus';
import {
  panelEmpty,
  panelList,
  rowCx,
  selectLabel,
  selectRow,
  selectRowOff,
  selectRowOn,
  selectSub,
} from './panelStyle';

interface AudioPanelProps {
  tracks: AudioTrack[];
  current: number;
  onSelect: (index: number) => void;
  onBack: () => void;
}

/** Audio-track picker (§5): language + title on top, a codec · channel sub-line. */
export const AudioPanel = forwardRef<PanelHandle, AudioPanelProps>(function AudioPanel(
  { tracks, current, onSelect, onBack },
  ref,
) {
  const t = useT();
  const pick = (i: number) => {
    const track = tracks[i];
    if (track) {
      onSelect(track.index);
      onBack();
    }
  };
  const focus = useListFocus({ count: tracks.length, onActivate: pick, onBack });
  useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

  if (tracks.length === 0) {
    return <div className={panelEmpty}>{t('player.noAudioTracks')}</div>;
  }

  return (
    <div className={panelList}>
      {tracks.map((a, i) => {
        const ch = channelLabel(a.channels);
        const codec = a.codec.toUpperCase();
        return (
          <button
            key={a.index}
            type="button"
            onClick={() => pick(i)}
            onMouseEnter={focus.hover(i)}
            className={rowCx(selectRow, selectRowOn, selectRowOff, focus.index === i)}
          >
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${selectLabel}`}>
                {a.title?.trim() || langName(t, a.language) || t('player.langUnknown')}
              </span>
              <span className={`block ${selectSub}`}>{ch ? `${codec} · ${ch}` : codec}</span>
            </span>
            {a.index === current ? (
              <span className="flex flex-none text-accent">
                <IconOk size={24} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
