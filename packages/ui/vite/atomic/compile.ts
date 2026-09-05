// One resolved declaration to its atomic classes and the rules behind them, by
// the same compiler react-native-web runs in the browser. Same identifiers,
// same declarations: a class the build emitted and one the runtime would have
// minted for the same value are the same class.

import { createRequire } from 'node:module';

type OrderedRules = readonly (readonly [rules: readonly string[], group: number])[];

interface Compiler {
  atomic(style: Record<string, unknown>): [Record<string, unknown>, OrderedRules];
}

interface Preprocessor {
  preprocess(
    style: Record<string, unknown>,
    options: Record<string, boolean>,
  ): Record<string, unknown>;
}

const require = createRequire(import.meta.url);

const { atomic } = require('react-native-web/dist/cjs/exports/StyleSheet/compiler') as Compiler;

const { preprocess } =
  require('react-native-web/dist/cjs/exports/StyleSheet/preprocess') as Preprocessor;

/** A rule and the group that orders it in the sheet; react-native-web's own
 *  groups, so a longhand's class always outranks a shorthand's. */
export interface CompiledRule {
  readonly group: number;
  readonly css: string;
}

/** The rules longhands the engine already resolved need in the sheet. */
export function rulesOf(longhands: Record<string, unknown>): CompiledRule[] {
  const [, ordered] = atomic(preprocess(longhands, { shadow: true, textShadow: true }));
  return ordered.flatMap(([css, group]) => css.map((rule) => ({ group, css: rule })));
}
