// The story format, tested as the pure data transformation it is.
//
// The interesting claim is that a component's `sv` alone is enough to build its
// controls and its matrix. These tests hold that: declare variants, get the
// panel and the grid, with nothing else written down.

import { describe, expect, it } from 'vitest';
import { sv } from '../lib/sv';
import { GROUP_ORDER, orderStories, type Story, slug, story } from './story';

const variants = sv({
  base: { borderRadius: 4 },
  variants: {
    variant: { primary: {}, ghost: {} },
    size: { sm: {}, lg: {} },
    block: { true: {}, false: {} },
  },
  defaults: { variant: 'ghost', size: 'lg', block: 'false' },
});

describe('sv introspection', () => {
  it('carries its own declaration', () => {
    expect(variants.options).toEqual({
      variant: ['primary', 'ghost'],
      size: ['sm', 'lg'],
      block: ['true', 'false'],
    });
    expect(variants.defaults).toEqual({ variant: 'ghost', size: 'lg', block: 'false' });
    expect(variants.config.base).toEqual({ borderRadius: 4 });
  });

  it('still resolves styles', () => {
    expect(variants({ variant: 'primary' })).toEqual([{ borderRadius: 4 }, {}, {}, {}]);
  });
});

describe('story()', () => {
  const built = story({
    name: 'Poster card',
    group: 'Médias',
    variants,
    args: { label: 'Dune', count: 3, muted: true, onPress: () => {} },
    render: () => null,
  });

  it('slugs the name into a stable id', () => {
    expect(built.id).toBe('poster-card');
    expect(slug('ProgressRing')).toBe('progress-ring');
    expect(slug('Icônes')).toBe('icones');
  });

  it('derives a control per variant group, variants first', () => {
    const keys = built.controls.map((control) => control.key);
    expect(keys.slice(0, 3)).toEqual(['variant', 'size', 'block']);
    expect(built.controls.filter((control) => control.variant)).toHaveLength(3);
  });

  it('reads a true/false group as a real boolean rather than two strings', () => {
    const block = built.controls.find((control) => control.key === 'block');
    expect(block?.control).toEqual({ kind: 'boolean' });
    expect(built.args.block).toBe(false);
    expect(built.matrix.find((row) => row.group === 'block')?.options).toEqual([false, true]);
  });

  it('seeds args from the variant defaults', () => {
    expect(built.args.variant).toBe('ghost');
    expect(built.args.size).toBe('lg');
  });

  it('infers a control from each arg value', () => {
    const byKey = Object.fromEntries(built.controls.map((c) => [c.key, c.control]));
    expect(byKey.label).toEqual({ kind: 'text' });
    expect(byKey.muted).toEqual({ kind: 'boolean' });
    expect(byKey.count).toEqual({ kind: 'number', min: 0, max: 100, step: 1 });
  });

  it('gives a prop with no editable shape no control, but still passes it through', () => {
    expect(built.controls.some((control) => control.key === 'onPress')).toBe(false);
    expect(built.args.onPress).toBeTypeOf('function');
  });

  it('builds one matrix row per variant group', () => {
    expect(built.matrix.map((row) => row.group)).toEqual(['variant', 'size', 'block']);
    expect(built.matrix[0]?.options).toEqual(['primary', 'ghost']);
  });
});

describe('explicit controls', () => {
  it('overrides inference', () => {
    const built = story({
      name: 'Progress',
      group: 'État',
      args: { value: 0.4, tone: 'info', icon: 'search' },
      controls: {
        value: { min: 0, max: 1, step: 0.05 },
        tone: ['info', 'danger'],
        icon: 'icon',
      },
      render: () => null,
    });
    const byKey = Object.fromEntries(built.controls.map((c) => [c.key, c.control]));
    expect(byKey.value).toEqual({ kind: 'number', min: 0, max: 1, step: 0.05 });
    expect(byKey.tone).toEqual({ kind: 'select', options: ['info', 'danger'] });
    // The icon control leads with the empty option, so "no icon" is reachable.
    expect((byKey.icon as { options: string[] }).options[0]).toBe('');
    expect((byKey.icon as { options: string[] }).options).toContain('search');
  });
});

describe('scenes and matrix opt-out', () => {
  const built = story({
    name: 'Empty state',
    group: 'État',
    variants,
    matrix: false,
    args: { title: 'Rien' },
    render: (args) => `render:${args.title}` as unknown as null,
    scenes: [{ name: 'Avec action', args: { title: 'Scene' } }],
  });

  it('drops the matrix when asked', () => {
    expect(built.matrix).toEqual([]);
    // The controls survive: only the grid was suppressed.
    expect(built.controls.length).toBeGreaterThan(0);
  });

  it('merges a scene args over the live ones', () => {
    expect(built.scenes[0]?.render({ title: 'Live' })).toBe('render:Scene');
  });
});

describe('orderStories', () => {
  const make = (group: string, name: string) => ({ id: slug(name), group, name }) as Story;

  it('follows the declared group order, then sorts by name', () => {
    const sorted = orderStories([
      make('Marque', 'Wheel'),
      make('Actions', 'Chip'),
      make('Actions', 'Button'),
      make('Fondations', 'Couleurs'),
    ]);
    expect(sorted.map((s) => s.name)).toEqual(['Couleurs', 'Button', 'Chip', 'Wheel']);
  });

  it('puts an unlisted group last instead of silently dropping it', () => {
    const sorted = orderStories([make('Zzz inconnu', 'Truc'), make('Marque', 'Logo')]);
    expect(sorted.map((s) => s.group)).toEqual(['Marque', 'Zzz inconnu']);
    expect(GROUP_ORDER).toContain('Marque');
  });
});
