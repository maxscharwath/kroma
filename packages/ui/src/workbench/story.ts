// The story format.
//
// A story is a plain object describing how to render one component and what
// about it is worth changing. It is deliberately smaller than Storybook's CSF:
// there is no meta/export-per-variation split, no decorators, no parameters, no
// addon protocol. One default export per component, next to the component.
//
// What replaces the missing machinery is `sv`. A component's variant map is
// already the single source of truth for its design, so passing it to a story
// gives the workbench the controls AND the variant matrix with nothing written
// by hand. Storybook needs argTypes or a docgen pass to get there, and both can
// drift from the component; this cannot, because it IS the component.
//
//   export default story({
//     name: 'Button',
//     group: 'Actions',
//     variants: buttonVariants,
//     args: { label: 'Lecture' },
//     render: (props) => <Button {...props} />,
//   });

import type { ReactNode } from 'react';
import { ICON_NAMES } from '../lib/glyph';
import type { SvFn, VariantGroups } from '../lib/sv';

/** Any compiled `sv`, with its declaration erased. Stories are collected into
 * one heterogeneous list, so the registry cannot carry each component's variant
 * types; authoring stays typed through `story()` below. */
type AnySv = SvFn<VariantGroups>;

type Args = Record<string, unknown>;

/** How a prop is written at a call site, in the shorthand a story author uses.
 * An array is a set of choices; an object is a numeric range. */
type ControlSpec =
  | 'text'
  | 'boolean'
  | 'number'
  | 'icon'
  | readonly string[]
  | { min: number; max: number; step?: number };

/** A control, resolved into the one shape the panel renders. */
type Control =
  | { kind: 'text' }
  | { kind: 'boolean' }
  | { kind: 'number'; min: number; max: number; step: number }
  | { kind: 'select'; options: string[] };

interface ResolvedControl {
  key: string;
  control: Control;
  /** True when this came from the component's own `sv` rather than from `args`.
   * The panel groups them separately: variants are the design's axes, plain
   * props are the content you feed it. */
  variant: boolean;
}

/** One row of the derived matrix: a variant group and every option in it. */
interface MatrixRow {
  group: string;
  options: unknown[];
}

/** `const A` pins every default to its literal type, which is what makes a typo
 * in an icon name a compile error. A scene that overrides one of those defaults
 * would then be limited to the SAME literal, which is useless, so scene args are
 * widened back to the underlying primitive. */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T;

interface SceneDef<A extends Args> {
  name: string;
  docs?: string;
  /** Omit to render the story's own `render` with `args` merged over the
   * defaults, which covers most scenes. */
  render?: (args: A) => ReactNode;
  args?: { [K in keyof A]?: Widen<A[K]> };
}

/**
 * `render` is typed against the story's own `args` and nothing else, even though
 * the object it receives at runtime also carries the resolved variants. Typing
 * it as "args plus an index signature" would widen every prop to `unknown` and
 * break the one thing that has to work: `render: (props) => <Button {...props} />`.
 * The variants that ride along are already validated by the component's `sv`,
 * which is where they came from.
 */
interface StoryDef<A extends Args> {
  name: string;
  /** Sidebar section. Keep the set small; it is navigation, not taxonomy. */
  group: string;
  /** What the component is FOR, in a sentence or two. Shown beside it. */
  docs?: string;
  /** The component's compiled `sv`. Supplies controls and the matrix. */
  variants?: AnySv;
  /** Props that are not variants: the content, the callbacks, the sizes. */
  args?: A;
  /** Only needed where a value's type does not say enough: an enum that is not
   * a variant, a number with a real range, an icon name. */
  controls?: { [K in keyof A]?: ControlSpec };
  render: (args: A) => ReactNode;
  /** Compositions a matrix cannot express: an open dialog, a stateful toggle. */
  scenes?: readonly SceneDef<A>[];
  /** Suppress the derived matrix where a grid of variants says nothing. */
  matrix?: false;
  /** Room around the component on the canvas, when it needs to breathe. */
  pad?: number;
  /** Fixed canvas width, for components that measure themselves (rail, grid). */
  width?: number;
}

interface Scene {
  name: string;
  docs?: string;
  render: (args: Args) => ReactNode;
}

/** A story after compilation: everything the workbench needs, nothing it has to
 * derive again at render time. */
interface Story {
  id: string;
  name: string;
  group: string;
  docs?: string;
  /** Defaults for every control, variants included. */
  args: Args;
  controls: ResolvedControl[];
  matrix: MatrixRow[];
  scenes: Scene[];
  render: (args: Args) => ReactNode;
  pad: number;
  width?: number;
}

/** A variant group holding exactly these options is the `sv` spelling of a
 * boolean prop (`block`, `active`), so it is surfaced as a real boolean rather
 * than as a two-item dropdown of strings. */
const BOOLEAN_OPTIONS = new Set(['true', 'false']);

function isBooleanGroup(options: readonly string[]): boolean {
  return options.length === 2 && options.every((option) => BOOLEAN_OPTIONS.has(option));
}

function resolveSpec(spec: ControlSpec): Control {
  if (spec === 'text') return { kind: 'text' };
  if (spec === 'boolean') return { kind: 'boolean' };
  if (spec === 'number') return { kind: 'number', min: 0, max: 100, step: 1 };
  if (spec === 'icon') return { kind: 'select', options: ['', ...ICON_NAMES] };
  if (Array.isArray(spec)) return { kind: 'select', options: [...spec] };
  const range = spec as { min: number; max: number; step?: number };
  return { kind: 'number', min: range.min, max: range.max, step: range.step ?? 1 };
}

/** Infer a control from the default value alone. This is what keeps most
 * stories down to `args` and nothing else. */
function inferSpec(value: unknown): Control | null {
  if (typeof value === 'string') return { kind: 'text' };
  if (typeof value === 'boolean') return { kind: 'boolean' };
  if (typeof value === 'number') return { kind: 'number', min: 0, max: 100, step: 1 };
  return null;
}

function slug(name: string): string {
  return (
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // Strip diacritics before the alphanumeric filter, so "Icônes" deep-links as
      // ?story=icones rather than as ?story=ic-nes.
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

// `const A`: without it, `args: { icon: 'volume' }` infers `string` and every
// story that feeds a union-typed prop stops compiling. With it the defaults keep
// their literal types, so a typo in an icon name is a type error in the story
// rather than a blank square in the canvas.
function story<const A extends Args = Record<string, never>>(def: StoryDef<A>): Story {
  const args: Args = { ...def.args };
  const controls: ResolvedControl[] = [];
  const matrix: MatrixRow[] = [];

  // Variants first: they are the component's own axes, so they lead the panel
  // and they are the whole content of the matrix.
  for (const [group, raw] of Object.entries(def.variants?.options ?? {})) {
    const options = raw.map(String);
    const fallback = def.variants?.defaults?.[group];
    if (isBooleanGroup(options)) {
      controls.push({ key: group, control: { kind: 'boolean' }, variant: true });
      matrix.push({ group, options: [false, true] });
      args[group] ??= String(fallback) === 'true';
    } else {
      controls.push({ key: group, control: { kind: 'select', options }, variant: true });
      matrix.push({ group, options });
      args[group] ??= fallback === undefined ? options[0] : String(fallback);
    }
  }

  for (const [key, value] of Object.entries(def.args ?? {})) {
    const spec = def.controls?.[key as keyof A];
    const control = spec ? resolveSpec(spec) : inferSpec(value);
    // A prop with no editable shape (a callback, an array, an object) still
    // reaches `render`; it just has no row in the panel.
    if (control) controls.push({ key, control, variant: false });
  }

  const scenes: Scene[] = (def.scenes ?? []).map((scene) => ({
    name: scene.name,
    docs: scene.docs,
    render: (current: Args) => {
      const merged = { ...current, ...scene.args } as unknown as A;
      return (scene.render ?? def.render)(merged);
    },
  }));

  return {
    id: slug(def.name),
    name: def.name,
    group: def.group,
    docs: def.docs,
    args,
    controls,
    matrix: def.matrix === false ? [] : matrix,
    scenes,
    render: (current: Args) => def.render(current as unknown as A),
    pad: def.pad ?? 0,
    width: def.width,
  };
}

/**
 * Sidebar order. Foundations first because everything else is built out of them,
 * then the things you compose with, then the brand. Any group not listed follows,
 * alphabetically, so adding one is never a silent no-op.
 */
const GROUP_ORDER = ['Fondations', 'Mise en page', 'Actions', 'Saisie', 'Médias', 'État', 'Marque'];

/** Sorts the generated registry for display. It lives here rather than in the
 * generator so the ordering is ordinary, testable code instead of something
 * baked into a file nobody reads. */
function orderStories(stories: readonly Story[]): Story[] {
  const rank = (group: string) => {
    const at = GROUP_ORDER.indexOf(group);
    return at === -1 ? GROUP_ORDER.length : at;
  };
  return [...stories].sort(
    (a, b) =>
      rank(a.group) - rank(b.group) ||
      a.group.localeCompare(b.group) ||
      a.name.localeCompare(b.name),
  );
}

export type { Control, ControlSpec, MatrixRow, ResolvedControl, Scene, Story, StoryDef };
export { GROUP_ORDER, isBooleanGroup, orderStories, slug, story };
