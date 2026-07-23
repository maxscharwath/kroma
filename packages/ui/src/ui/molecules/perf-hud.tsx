// The performance HUD: the numbers, on the screen they are about.
//
// A television is the only place these numbers mean anything, and it is the one
// place a profiler is hardest to attach - Samsung blocks the log, the simulator
// lies about the CPU, and a laptop browser is ten times too fast. So the app
// carries its own read-out: turn it on in the device settings, walk the remote
// around, and read what the viewer is actually getting.
//
// What to look at, in order:
//   RÉPONSE   press-to-focus. Over ~120ms the remote feels heavy, whatever the
//             frame rate says.
//   PIRE      the worst frame in the window. One 200ms frame is a visible jolt
//             even at "60 fps" on average.
//   SACCADES  how many frames blew two 60Hz budgets. Zero is the target.

import { useEffect, useState } from 'react';
import { type PerfReport, perfReport, startPerf, stopPerf } from '../../lib/perf';
import { colors, radius } from '../../lib/tokens';
import { Box } from '../primitives/box';
import { Txt } from '../primitives/text';

/** How often the read-out refreshes. Slow enough to read, fast enough to blame
 * the thing you just did. */
const REFRESH_MS = 500;

function PerfHud({ enabled }: Readonly<{ enabled: boolean }>) {
  const [report, setReport] = useState<PerfReport | null>(null);

  useEffect(() => {
    if (!enabled) return;
    startPerf();
    const timer = setInterval(() => setReport(perfReport()), REFRESH_MS);
    return () => {
      clearInterval(timer);
      stopPerf();
    };
  }, [enabled]);

  if (!enabled || !report) return null;
  return (
    <Box absolute style={PANEL} pointerEvents="none">
      <Row label="FPS" value={String(report.fps)} bad={report.fps < 45} />
      <Row label="PIRE" value={`${report.worstFrame} ms`} bad={report.worstFrame > 50} />
      <Row label="SACCADES" value={String(report.jankyFrames)} bad={report.jankyFrames > 0} />
      <Row
        label="RÉPONSE"
        value={report.responseCount ? `${report.responseP50} / ${report.responseWorst} ms` : '-'}
        bad={report.responseP50 > 120}
      />
    </Box>
  );
}

function Row({ label, value, bad }: Readonly<{ label: string; value: string; bad: boolean }>) {
  return (
    <Box row between gap={16}>
      <Txt style={LABEL} color="textDim">
        {label}
      </Txt>
      <Txt style={VALUE} color={bad ? 'danger' : 'success'}>
        {value}
      </Txt>
    </Box>
  );
}

const PANEL = {
  top: 24,
  right: 24,
  zIndex: 999,
  minWidth: 260,
  gap: 4,
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: radius.md,
  backgroundColor: 'rgba(10, 10, 12, 0.86)',
  borderWidth: 1,
  borderColor: colors.border,
} as const;

const LABEL = { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1 };
const VALUE = { fontSize: 15, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] };

export { PerfHud };
