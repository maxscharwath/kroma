// `sv`, the recipe compiler: a props-to-style lookup for React Native, which has
// no className for cva/tailwind-variants to drive. Panda's `cva` shape, with
// interaction states nested under a `_` prefix inside the style they change.
//
// See packages/ui/README.md for the authoring guide.

import { type Split, split, stabilise } from '#ui/core/normalize';
import { maskOf, SV_STATES, type SvState, type SvStateName, stateSuffix } from '#ui/core/states';
import { themeVersion } from '#ui/core/theme';
import type {
  CompoundVariant,
  FlatVariantGroups,
  Layer,
  SlotShapes,
  StyleDecl,
  StyleSlots,
  SvConfig,
  SvFlatConfig,
  SvFn,
  VariantGroups,
  VariantPicks,
} from '#ui/core/types';

// The key is built from the raw pick, so an undeclared variant value still mints
// an entry. Past the cap the recipe stops caching and behaves as before.
const CACHE_LIMIT = 1024;

/** Single slot: `base` plus flat variant options, which is most components. */
export function sv<const V extends FlatVariantGroups = Record<string, never>>(
  config: SvFlatConfig<V>,
): SvFn<{ root: StyleDecl }, V>;

/** Named slots, all painted. Only the names are inferred, never the shapes: a
 *  variant option paints keys the base never mentioned. */
export function sv<
  S extends Record<string, StyleDecl>,
  const V extends VariantGroups<StyleSlots<S>> = Record<string, never>,
>(config: SvConfig<StyleSlots<S>, V> & { slots: S }): SvFn<StyleSlots<S>, V>;

export function sv(
  config: SvConfig<SlotShapes, VariantGroups<SlotShapes>> | SvFlatConfig<FlatVariantGroups>,
): unknown {
  // Normalised here into one slot called `root`, so everything past this point
  // sees only the slotted form.
  const flat = 'base' in config;
  const slots = flat ? { root: config.base } : config.slots;
  const wrap = (layer: unknown): Record<string, unknown> =>
    (flat ? { root: layer } : layer) as Record<string, unknown>;

  const variants = config.variants as Record<string, Record<string, unknown>> | undefined;
  const compound = config.compound as readonly CompoundVariant<unknown, unknown>[] | undefined;
  const defaults = (config.defaults ?? {}) as Record<string, PropertyKey | undefined>;
  const groups = variants ? Object.keys(variants) : [];
  const names = Object.keys(slots);

  interface Compiled {
    bases: Split[];
    options: Record<string, Record<string, (Split | undefined)[]>>;
    rules: { when: [string, PropertyKey | undefined][]; layers: (Split | undefined)[] }[];
    mask: number;
    cache: Map<string, Record<string, object>>;
  }

  // Tokens resolve during `split`, so the compiled form belongs to one theme:
  // it is built on first use and rebuilt when the theme version moves, which is
  // also what drops the old theme's cache.
  const build = (): Compiled => {
    const declared = new Set<SvStateName>();
    const layersOf = (layer: unknown): (Split | undefined)[] => {
      const wrapped = wrap(layer);
      return names.map((name) => {
        const piece = split(wrapped[name] as Record<string, unknown>);
        for (const state of piece?.declared ?? []) declared.add(state);
        return piece;
      });
    };

    const bases = names.map((name) => {
      const piece = split(slots[name] as Record<string, unknown>) as Split;
      for (const state of piece.declared) declared.add(state);
      return piece;
    });

    const options: Compiled['options'] = {};
    for (const group of groups) {
      const bucket: Record<string, (Split | undefined)[]> = {};
      for (const [option, layer] of Object.entries(variants?.[group] ?? {}))
        bucket[option] = layersOf(layer);
      options[group] = bucket;
    }

    const rules = (compound ?? []).map((rule) => ({
      when: Object.entries(rule.when as Record<string, PropertyKey | undefined>),
      layers: layersOf(rule.style),
    }));

    // A recipe declaring no states pays nothing for the axis: one cache entry
    // per variant combination, and no sweep.
    return { bases, options, rules, mask: maskOf(declared), cache: new Map() };
  };

  let compiled: Compiled | undefined;
  let builtAt = -1;

  const fn = ((picks?: Record<string, PropertyKey | undefined>, state?: SvState) => {
    const at = themeVersion();
    if (builtAt !== at) {
      compiled = build();
      builtAt = at;
    }
    const { bases, options, rules, mask, cache } = compiled as Compiled;
    const stateful = mask !== 0;
    const pickOf = (group: string): PropertyKey | undefined => picks?.[group] ?? defaults[group];

    let key = '';
    for (const group of groups) key += `${String(pickOf(group))}|`;
    key += stateSuffix(state, mask);

    const hit = cache.get(key);
    if (hit) return hit;

    // Cascade order, decided once for every slot rather than per slot.
    const layers: (Split | undefined)[][] = [bases];
    for (const group of groups) {
      const pick = pickOf(group);
      const layer = pick === undefined ? undefined : options[group]?.[String(pick)];
      if (layer) layers.push(layer);
    }
    for (const rule of rules) {
      if (rule.when.every(([group, value]) => pickOf(group) === value)) layers.push(rule.layers);
    }

    const out: Record<string, unknown> = {};
    for (let i = 0; i < names.length; i++) {
      const merged: Record<string, unknown> = {};
      for (const layer of layers) Object.assign(merged, layer[i]?.rest);
      if (stateful) {
        // Each state sweeps every layer again, so a variant's `_hover` beats the
        // base's.
        for (const name of SV_STATES) {
          if (state?.[name] !== true) continue;
          for (const layer of layers) Object.assign(merged, layer[i]?.states[name]);
        }
      }
      out[names[i] as string] = stabilise(merged);
    }

    const frozen = Object.freeze(out) as Record<string, object>;
    if (cache.size < CACHE_LIMIT) cache.set(key, frozen);
    return frozen;
  }) as unknown as SvFn<SlotShapes, VariantGroups<SlotShapes>> & Record<string, unknown>;

  fn.defaults = defaults as VariantPicks<VariantGroups<SlotShapes>>;
  fn.options = Object.fromEntries(
    groups.map((group) => [group, Object.keys(variants?.[group] ?? {})]),
  ) as SvFn<SlotShapes, VariantGroups<SlotShapes>>['options'];
  fn.slots = names;
  return fn;
}

/**
 * Names the slot shapes up front, for a recipe with a slot that feeds a
 * component's props rather than its style:
 *
 *   svFor<{ root: StyleDecl; icon: IconProps }>()({ slots: { … }, variants: { … } })
 *
 * Curried because TypeScript has no partial type-argument inference: naming the
 * shapes inline would forfeit inference of the variant groups, and every option
 * name would widen to `string`.
 */
export function svFor<P extends SlotShapes>() {
  return <const V extends VariantGroups<P> = Record<string, never>>(
    config: SvConfig<P, V>,
  ): SvFn<P, V> => sv(config as never) as SvFn<P, V>;
}

export type { Layer, SvConfig, SvFlatConfig, SvFn };
