// The workbench sidebar: search, then every story grouped by section.
//
// It is a list of `Focusable`s rather than a scroll of links, so the same
// sidebar is operated with a mouse in a browser and with a D-pad on a
// television. The search field takes a physical keyboard where there is one and
// falls back to the kit's on-screen keyboard where there is not.

import { ScrollView } from 'react-native';
import { colors } from '../lib/tokens';
import { Box } from '../ui/primitives/box';
import { Focusable } from '../ui/primitives/focusable';
import { Txt } from '../ui/primitives/text';
import { TextField } from '../ui/primitives/text-field';
import type { Story } from './story';

interface SidebarProps {
  stories: readonly Story[];
  selected: string;
  query: string;
  onQuery: (next: string) => void;
  onSelect: (id: string) => void;
}

/** Case-insensitive match on the name or the section, so "act" finds every
 * story in "Actions" and "prog" finds Progress and ProgressRing. */
function matches(story: Story, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return story.name.toLowerCase().includes(needle) || story.group.toLowerCase().includes(needle);
}

function Sidebar({ stories, selected, query, onQuery, onSelect }: Readonly<SidebarProps>) {
  const visible = stories.filter((story) => matches(story, query));
  const groups = [...new Set(visible.map((story) => story.group))];

  return (
    <Box w={280} bg="surface1" style={BORDER}>
      <Box p={16}>
        <TextField
          value={query}
          onChange={onQuery}
          placeholder="Rechercher"
          icon="search"
          physicalKeyboard
          py={10}
          radius="md"
          bg="surface2"
          label="Rechercher un composant"
          textStyle={INPUT}
        />
      </Box>
      <ScrollView style={SCROLL} contentContainerStyle={LIST}>
        <Box>
          {groups.map((group) => (
            <Box key={group} gap={2} mb={12}>
              <Box px={20} py={8}>
                <Txt variant="overline" color="textDim">
                  {group}
                </Txt>
              </Box>
              {visible
                .filter((story) => story.group === group)
                .map((story) => (
                  <Focusable
                    key={story.id}
                    label={story.name}
                    ring={false}
                    onPress={() => onSelect(story.id)}
                    style={[ITEM, story.id === selected && ITEM_ACTIVE]}
                  >
                    <Txt
                      variant="body"
                      color={story.id === selected ? 'accent' : 'textMuted'}
                      lines={1}
                    >
                      {story.name}
                    </Txt>
                  </Focusable>
                ))}
            </Box>
          ))}
          {visible.length === 0 ? (
            <Box px={20} py={12}>
              <Txt variant="meta" color="textDim">
                Aucun composant
              </Txt>
            </Box>
          ) : null}
        </Box>
      </ScrollView>
    </Box>
  );
}

const SCROLL = { flex: 1 } as const;
const LIST = { paddingBottom: 32 } as const;
const BORDER = { borderRightWidth: 1, borderRightColor: colors.border } as const;
const ITEM = { paddingHorizontal: 20, paddingVertical: 9 } as const;
const ITEM_ACTIVE = { backgroundColor: colors.accentSoft } as const;
const INPUT = { fontSize: 14, fontWeight: '600' as const };

export type { SidebarProps };
export { matches, Sidebar };
