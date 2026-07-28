import { story } from '@kroma/workbench/story';
import { useEffect, useState } from 'react';
import { Box } from '#ui/components/atoms/box';
import { chromeMetrics, GUTTER } from '../lib/metrics';
import type { ControlId } from '../lib/nav';
import { ControlCluster } from './ControlCluster';

const ALL: ControlId[] = [
  'rewind',
  'play',
  'forward',
  'next',
  'volume',
  'subtitles',
  'audio',
  'settings',
  'pip',
  'fullscreen',
];

interface LiveProps {
  focused: ControlId;
  playing: boolean;
  muted: boolean;
  volume: number;
  pipActive: boolean;
  fullscreen: boolean;
}

/**
 * The row wired to state, because the three things it does are all callbacks:
 * hover moves the focus ring, pressing play swaps the glyph, and the volume rail
 * is a drag. Handed no-ops, the story could only ever show one frozen frame of
 * a control surface.
 */
function Live({ focused: focusedArg, playing, muted, volume, ...rest }: Readonly<LiveProps>) {
  const [state, setState] = useState({ focused: focusedArg, playing, muted, volume });
  // The controls in the panel are the other way to drive it, so they win.
  useEffect(() => {
    setState({ focused: focusedArg, playing, muted, volume });
  }, [focusedArg, playing, muted, volume]);

  const activate = (id: ControlId) => {
    if (id === 'play') setState((prev) => ({ ...prev, playing: !prev.playing }));
    if (id === 'volume') setState((prev) => ({ ...prev, muted: !prev.muted }));
  };

  // The player hands the row its metrics; the story measures the canvas itself,
  // so switching the workbench viewport (or dragging the window) walks it
  // through all three layouts.
  const [width, setWidth] = useState(0);
  const metrics = chromeMetrics(ALL, width);

  return (
    <Box
      flex
      justify="flex-end"
      px={GUTTER}
      pb={40}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      <ControlCluster
        {...rest}
        controls={ALL}
        focused={state.focused}
        playing={state.playing}
        muted={state.muted}
        volume={state.volume}
        metrics={metrics}
        onActivate={activate}
        onFocus={(id) => setState((prev) => ({ ...prev, focused: id }))}
        onVolume={(next) => setState((prev) => ({ ...prev, muted: false, volume: next }))}
      />
    </Box>
  );
}

export default story({
  name: 'PlayerControls',
  group: 'Media',
  docs: 'The transport row. Which controls exist is decided by the player (no `next` without a next episode, no `pip` where the platform has none) and handed in as a list, so this draws whatever it is given rather than knowing about episodes or platforms. One `onActivate` serves a mouse click and a D-pad OK alike, and hover moves focus so a pointer and a remote agree on where they are.\n\nIt is drawn for the 1920 stage but not fixed to it: `metrics` (from `chromeMetrics`, which weighs the controls actually present against the width there is) shrinks every circle together, then lets the cluster claim its width from the centring spacer, and finally stacks the cluster under the transport rather than shrink a button below the size of a fingertip. Switch the viewport to a phone to watch it go.',
  usage: `<ControlCluster
  controls={controlsFor({ hasNext, pip, fullscreen })}
  focused={nav.control}
  playing={playing}
  muted={muted}
  volume={volume}
  metrics={chromeMetrics(controls, stageWidth)}
  onActivate={run}
  onFocus={nav.focus}
  onVolume={setVolume}
/>`,
  guidelines: {
    do: [
      'Build `controls` from what the platform and the item actually support.',
      'Share one `onActivate` between pointer and remote: they run the same thing.',
      'Pass `metrics` measured on the stage the row is drawn in, not on the window.',
    ],
    dont: [
      "Don't hide a control by rendering it disabled - leave it out of the list.",
      "Don't drop controls to make a narrow row fit: a hidden control keeps its D-pad stop.",
    ],
  },
  matrix: false,
  args: {
    focused: 'play' as ControlId,
    playing: true,
    muted: false,
    volume: 0.7,
    pipActive: false,
    fullscreen: false,
  },
  controls: { focused: ALL, volume: { min: 0, max: 1, step: 0.05 } },
  render: (args) => <Live {...args} />,
  scenes: [
    {
      name: 'Paused, muted',
      args: { playing: false, muted: true, volume: 0, focused: 'volume' },
    },
    {
      name: 'On the settings gear',
      args: { focused: 'settings' },
    },
  ],
});
