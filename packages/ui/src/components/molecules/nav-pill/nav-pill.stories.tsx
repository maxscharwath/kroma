import { story } from '@kroma/workbench/story';
import { useState } from 'react';
import { Box } from '#ui/components/atoms/box';
import { NavPill, NavPillItem } from './nav-pill';

const SECTIONS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'films', label: 'Films', icon: 'movie' },
  { key: 'series', label: 'Series', icon: 'device-tv' },
  { key: 'search', label: 'Search', icon: 'search' },
] as const;

/** Wired, so Select actually moves the lens: the story's stand-in for the
 * navigation a press performs in the apps. */
function Switcher({ size }: Readonly<{ size: 'sm' | 'tv' }>) {
  const [active, setActive] = useState('home');
  return (
    <NavPill size={size}>
      {SECTIONS.map((section) => (
        <NavPillItem
          key={section.key}
          icon={section.icon}
          label={section.label}
          active={section.key === active}
          onPress={() => setActive(section.key)}
        />
      ))}
    </NavPill>
  );
}

export default story({
  name: 'NavPill',
  group: 'Layout',
  docs: 'The floating section switcher: a capsule of icon + label items with the current section in its own amber lens. The Apple TV top nav and the iPhone tab bar are this one design at two distances, which is what `size` means: **tv** keeps every label (a viewer is reading, and the capsule must hold its width under the travelling ring), **sm** labels only the active item (a thumb is on the glass). Compound, shadcn-fashion: items are children, so a host can ref one for focus wiring or badge another - things an `items` array cannot say.',
  usage: `<NavPill size="tv">
  <NavPillItem icon="home" label="Home" active onPress={goHome} />
  <NavPillItem icon="search" label="Search" onPress={goSearch} />
</NavPill>`,
  guidelines: {
    do: [
      'Keep it to a handful of top-level sections - it is the map, not the territory.',
      "Pass the iPhone's BlurView as `backdrop`; the fill thins so it reads through.",
    ],
    dont: [
      "Don't mark two items `active`: the lens is where you ARE.",
      "Don't blur on a television - Tizen composites it on the CPU and pays in frames, which is why the default fill is solid.",
    ],
  },
  matrix: false,
  args: {},
  render: () => (
    <Box gap={28} align="flex-start">
      <Switcher size="tv" />
      <Switcher size="sm" />
    </Box>
  ),
});
