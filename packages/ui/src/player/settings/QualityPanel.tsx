import { forwardRef, useImperativeHandle } from 'react';
import { IconOk } from '../icons';
import type { PanelHandle } from '../nav';
import type { PlayerQuality } from '../types';
import { useListFocus } from '../useListFocus';
import { panelList, rowCx, selectLabel, selectRow, selectRowOff, selectRowOn } from './panelStyle';

interface QualityPanelProps {
  qualities: PlayerQuality[];
  current: string;
  onSelect: (id: string) => void;
  /** Return to the settings menu (Back, or after a pick). */
  onBack: () => void;
}

/**
 * Quality picker (§5). The server is remux-only, so this reflects the honest
 * source ("Auto · <source>") rather than a fake ladder. Picking a quality selects
 * it and returns to the menu.
 */
export const QualityPanel = forwardRef<PanelHandle, QualityPanelProps>(function QualityPanel(
  { qualities, current, onSelect, onBack },
  ref,
) {
  const pick = (i: number) => {
    const q = qualities[i];
    if (q) onSelect(q.id);
    onBack();
  };
  const focus = useListFocus({ count: qualities.length, onActivate: pick, onBack });
  useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

  return (
    <div className={panelList}>
      {qualities.map((q, i) => (
        <button
          key={q.id}
          type="button"
          onClick={() => pick(i)}
          onMouseEnter={focus.hover(i)}
          className={rowCx(selectRow, selectRowOn, selectRowOff, focus.index === i)}
        >
          <span className={`min-w-0 flex-1 ${selectLabel}`}>{q.label}</span>
          {q.id === current ? (
            <span className="flex flex-none text-accent">
              <IconOk size={24} />
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
});
