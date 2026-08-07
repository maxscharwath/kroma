import { story } from '@kroma/workbench/story';
import { Box } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';
import { SplashBackdrop } from './splash-backdrop';

// Real photographs from the workbench's sample art (see lib/sample-art): the
// grade and ribbons only read over an actual image. Larger than the tile
// sizes on purpose: this one fills the whole story box.
const SPLASH_ART = 'https://picsum.photos/seed';
const COVERS = [
  {
    url: `${SPLASH_ART}/kroma-splash-1/1280/720`,
    caption: 'Grand large · 2024',
    eyebrow: 'Film',
  },
  {
    url: `${SPLASH_ART}/kroma-splash-2/1280/720`,
    caption: 'Contre-jour · 2022',
    eyebrow: 'Série',
  },
];

export default story({
  name: 'SplashBackdrop',
  group: 'Brand',
  docs: "The sign-in screens' ambient artwork, one implementation for web, phone and TV: covers dissolve on a slow breathing zoom under a grade dark enough to hold a form, with the **KROMA wheel stacked as tilted glass ribbons** across the lower frame. Hosts fetch the public `/api/splash` sample, map it to covers, and drop this behind their gate. Decorative by contract: it swallows no pointer events and hides from accessibility.",
  usage: `const covers = splash.map((e) => ({
  url: e.backdropUrl,
  caption: [e.title, e.year].filter(Boolean).join(' · '),
  eyebrow: t(e.kind === 'show' ? 'content.series' : 'content.film'),
}));

<SplashBackdrop covers={covers} />`,
  guidelines: {
    do: [
      'Give the host screen its own readable ground for text the grade alone cannot carry (fields and buttons already bring their fills).',
      'Raise `dim` when lists, keyboards or hints descend into the ribbon zone (the TV auth screens pass 0.45): muted ink keeps AA contrast and the colour still comes through.',
      'Turn `bands` off when the screen above is itself busy; the artwork alone still reads as KROMA.',
    ],
    dont: [
      "Don't feed it unsized artwork URLs; resolve them like any poster first.",
      "Don't stack another full-screen wash on top - the grade is calibrated for a centred form already.",
    ],
  },
  width: 'fill',
  render: () => (
    // Everything inside is absolutely positioned, so the frame must bring its
    // own size: the whole stage where the stage has a height (the device
    // viewports), a tall fixed frame where it does not (Fit).
    <Box
      style={{
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 520,
        overflow: 'hidden',
      }}
    >
      <SplashBackdrop covers={COVERS} holdMs={6000} />
      <Box absolute top={0} right={0} bottom={0} left={0} center>
        <Txt variant="h1">Qui regarde ?</Txt>
      </Box>
    </Box>
  ),
});
