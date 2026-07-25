import { story } from '@kroma/workbench/story';
import { MediaCard } from '#ui/components/molecules/media-card';
import { stillArt } from '#ui/lib/sample-art';
import { Rail } from './rail';

const TINT = ['#3A2E4F', '#1B1524'] as const;

export default story({
  name: 'Rail',
  group: 'Media',
  docs: 'A horizontal scrolling row. Given a tile PITCH (`item`) it runs on `<VirtualRail>`: the row holds still while the highlight travels and moves only when the selection comes within a tile of either end, a wheel pans it without changing the selection, and a pointer gets an arrow at each end. Without a pitch it falls back to the growing rail, which is for rows whose tiles are not all one width (chips, cast faces).',
  matrix: false,
  // Dynamic, the way it ships: the stage's width, clamped. Drag the window and
  // the row re-measures - which is the behaviour a fixed width hid.
  width: { min: 560, max: 1400 },
  args: { title: 'Continue watching', gap: 24, inset: 0, count: 24, virtualised: true },
  controls: { gap: { min: 8, max: 48, step: 4 }, count: { min: 1, max: 40, step: 1 } },
  render: ({ count, virtualised, gap, ...props }) => (
    <Rail
      {...props}
      gap={gap}
      // The pitch is the tile's own width PLUS the gap after it, which is what
      // the offset maths counts in.
      item={virtualised ? { width: 320 + gap, height: 180 } : undefined}
    >
      {Array.from({ length: count }, (_, index) => `Title ${index + 1}`).map((title, index) => (
        <MediaCard
          key={title}
          width={320}
          title={title}
          overline="Science fiction"
          art={stillArt(index)}
          tint={TINT}
          progress={index === 0 ? 0.35 : null}
          watched={index === 1}
        />
      ))}
    </Rail>
  ),
});
