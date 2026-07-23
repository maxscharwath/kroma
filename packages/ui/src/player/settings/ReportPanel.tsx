import type { ReportCategory } from '@kroma/core';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useT } from '../../i18n';
import { REPORT_CATEGORIES } from '../../lib/report-categories';
import { Box } from '../../ui/primitives/box';
import { Txt } from '../../ui/primitives/text';
import type { PanelHandle } from '../nav';
import { useListFocus } from '../useListFocus';
import { panelList } from './panelStyle';
import { SelectRow } from './select-row';

/** What a report from inside the player can be: a category, and nothing else.
 * Deliberately no free-text field the viewer is mid-film, and the thing being
 * reported is the thing on screen, which the server resolves from the subject
 * id anyway. Details belong to the detail page's report screen. */
interface ReportPanelProps {
  /** Sends the report. Rejects on failure, which the panel shows in place. */
  onReport: (category: ReportCategory) => Promise<void>;
  onBack: () => void;
}

export const ReportPanel = forwardRef<PanelHandle, ReportPanelProps>(function ReportPanel(
  { onReport, onBack },
  ref,
) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  const pick = (i: number) => {
    const category = REPORT_CATEGORIES[i]?.key;
    if (!category || state === 'busy' || state === 'done') return;
    setState('busy');
    onReport(category)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  };
  const focus = useListFocus({ count: REPORT_CATEGORIES.length, onActivate: pick, onBack });
  useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

  // Sent: the panel becomes its own receipt rather than closing itself. Closing
  // playback chrome from under the viewer is how you lose track of a film.
  if (state === 'done') {
    return (
      <Box style={panelList}>
        <Txt style={{ fontSize: 22, fontWeight: '600' }}>{t('report.submitted')}</Txt>
      </Box>
    );
  }

  return (
    <Box style={panelList}>
      {REPORT_CATEGORIES.map((c, i) => (
        <SelectRow
          key={c.key}
          label={t(c.labelKey)}
          sub={t(c.hintKey)}
          focused={focus.index === i}
          onActivate={() => pick(i)}
          onFocus={focus.hover(i)}
        />
      ))}
      {state === 'failed' ? (
        <Txt style={{ fontSize: 17, fontWeight: '600' }} color="danger">
          {t('report.failed')}
        </Txt>
      ) : null}
    </Box>
  );
});
