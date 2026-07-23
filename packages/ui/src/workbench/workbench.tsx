// The workbench shell.
//
// This is the replacement for Storybook, and the reason it can be this small is
// that it is not a separate application. Storybook ships a manager UI, an iframe
// protocol between it and your components, a builder abstraction and an addon
// API, because it has to host any framework's components inside its own React
// tree. Here the components and the tool are the same design system, rendered by
// the same renderer, in one tree. What is left after removing all of that is a
// list, a canvas and a controls panel.
//
// The consequence worth the trouble: it runs wherever the kit runs. Open it in a
// browser shell, or mount it in the Apple TV app, and you are inspecting the
// components on the device that actually has to display them.

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { type ColorToken, colors } from '../lib/tokens';
import { Box } from '../ui/primitives/box';
import { Button } from '../ui/primitives/button';
import { Chip } from '../ui/primitives/chip';
import { Divider } from '../ui/primitives/divider';
import { Logo } from '../ui/primitives/logo';
import { Txt } from '../ui/primitives/text';
import { Matrix, SURFACES, VIEWPORTS, ViewportFrame, type ViewportName } from './canvas';
import { Controls } from './controls';
import { STORIES } from './registry';
import { Sidebar } from './sidebar';
import type { Story } from './story';

/** What the canvas is showing: the live component, the derived variant matrix,
 * or one of the story's hand-written scenes (by index). */
type View = 'preview' | 'matrix' | number;

/** Deep-link state, read once at mount. Absent off the web, where there is no
 * URL to read and the workbench simply opens on the first story. */
function parseView(raw: string | null): View | undefined {
  if (!raw) return undefined;
  if (raw === 'matrix') return 'matrix';
  const scene = Number(raw);
  return Number.isFinite(scene) ? scene : undefined;
}

function urlState(): { story?: string; view?: View; shot: boolean } {
  if (typeof location === 'undefined') return { shot: false };
  const params = new URLSearchParams(location.search);
  return {
    story: params.get('story') ?? undefined,
    view: parseView(params.get('view')),
    // `shot` strips every piece of chrome so a screenshot frames the component
    // and nothing else. See scripts/shoot-stories.ts.
    shot: params.has('shot'),
  };
}

/** Keep the address bar in step, so a state worth showing someone is a link.
 * `replaceState` rather than `pushState`: flipping variants is not history. */
function syncUrl(story: string, view: View): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const params = new URLSearchParams(location.search);
  params.set('workbench', '');
  params.set('story', story);
  if (view === 'preview') params.delete('view');
  else params.set('view', String(view));
  history.replaceState(null, '', `${location.pathname}?${params}`);
}

function Workbench() {
  const initial = useMemo(urlState, []);
  const [selected, setSelected] = useState(initial.story ?? STORIES[0]?.id ?? '');
  const [view, setView] = useState<View>(initial.view ?? 'preview');
  const [query, setQuery] = useState('');
  const [viewport, setViewport] = useState<ViewportName>('fit');
  const [surface, setSurface] = useState<ColorToken>('bg');
  // Edits are kept per story, so wandering off to check another component and
  // coming back does not throw away what you had set up.
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});

  const story = STORIES.find((candidate) => candidate.id === selected) ?? STORIES[0];
  const args = useMemo(() => ({ ...story?.args, ...edits[story?.id ?? ''] }), [story, edits]);

  const select = useCallback((id: string) => {
    setSelected(id);
    setView('preview');
    syncUrl(id, 'preview');
  }, []);

  const show = useCallback(
    (next: View) => {
      setView(next);
      syncUrl(selected, next);
    },
    [selected],
  );

  const change = useCallback(
    (key: string, value: unknown) => {
      const id = story?.id ?? '';
      setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    },
    [story],
  );

  if (!story) return null;

  const body = renderBody(story, view, args);

  // `?shot` with no story is the screenshot runner asking what exists. Answering
  // from the app itself means there is no second list of ids to keep in step.
  if (initial.shot && !initial.story) {
    return <Txt>{`KROMA_STORY_IDS:${STORIES.map((entry) => entry.id).join(',')}`}</Txt>;
  }

  if (initial.shot) {
    return (
      <Box flex bg={surface} p={32} align="flex-start" justify="flex-start">
        {body}
      </Box>
    );
  }

  return (
    <Box flex row bg="bg">
      <Sidebar
        stories={STORIES}
        selected={story.id}
        query={query}
        onQuery={setQuery}
        onSelect={select}
      />

      <Box flex>
        <Header story={story} view={view} onView={show} />
        <Box row px={20} py={12} gap={20} align="center" style={RULE}>
          <Segmented
            values={Object.keys(VIEWPORTS) as ViewportName[]}
            value={viewport}
            onChange={setViewport}
          />
          <Divider vertical />
          <Segmented values={SURFACES} value={surface} onChange={setSurface} />
        </Box>
        <ViewportFrame viewport={viewport} surface={surface} pad={story.pad} width={story.width}>
          {body}
        </ViewportFrame>
      </Box>

      <Box w={320} bg="surface1" style={PANEL}>
        <ScrollView contentContainerStyle={PANEL_BODY}>
          {story.docs ? (
            <Box gap={10} mb={24}>
              <Txt variant="overline" color="accent">
                À quoi ça sert
              </Txt>
              <Txt variant="meta" color="textMuted">
                {story.docs}
              </Txt>
            </Box>
          ) : null}
          <Controls controls={story.controls} args={args} onChange={change} />
          {story.controls.length > 0 ? (
            <Box mt={28}>
              <Button
                variant="ghost"
                size="sm"
                label="Réinitialiser"
                onPress={() => setEdits((prev) => ({ ...prev, [story.id]: {} }))}
              />
            </Box>
          ) : null}
        </ScrollView>
      </Box>
    </Box>
  );
}

/** What the canvas shows for the current tab. */
function renderBody(story: Story, view: View, args: Record<string, unknown>): ReactNode {
  if (view === 'matrix') return <Matrix rows={story.matrix} args={args} render={story.render} />;
  if (typeof view === 'number') return story.scenes[view]?.render(args);
  return story.render(args);
}

/** Title bar plus the canvas tabs: the live component, the derived matrix, then
 * whatever scenes the story wrote by hand. */
function Header({
  story,
  view,
  onView,
}: Readonly<{ story: Story; view: View; onView: (next: View) => void }>) {
  return (
    <Box row align="center" gap={20} px={20} py={16} style={RULE}>
      <Logo size={22} />
      <Txt variant="title">{story.name}</Txt>
      <Box flex />
      <Box row gap={8}>
        <Chip
          variant="subtle"
          label="Aperçu"
          active={view === 'preview'}
          onPress={() => onView('preview')}
        />
        <Chip
          variant="subtle"
          label="Matrice"
          active={view === 'matrix'}
          onPress={() => onView('matrix')}
        />
        {story.scenes.map((scene, index) => (
          <Chip
            key={scene.name}
            variant="subtle"
            label={scene.name}
            active={view === index}
            onPress={() => onView(index)}
          />
        ))}
      </Box>
    </Box>
  );
}

/** A row of mutually exclusive chips. Small enough to live here rather than
 * become a kit primitive the app would never use. */
function Segmented<T extends string>({
  values,
  value,
  onChange,
}: Readonly<{ values: readonly T[]; value: T; onChange: (next: T) => void }>) {
  return (
    <Box row gap={8}>
      {values.map((option) => (
        <Chip
          key={option}
          variant="surface"
          label={option}
          active={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </Box>
  );
}

const RULE = { borderBottomWidth: 1, borderBottomColor: colors.border } as const;
const PANEL = { borderLeftWidth: 1, borderLeftColor: colors.border } as const;
const PANEL_BODY = { padding: 20, paddingBottom: 64 } as const;

export { Workbench };
