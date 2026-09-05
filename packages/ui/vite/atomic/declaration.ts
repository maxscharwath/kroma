// From a declaration the evaluator produced to the compiled leaf the build
// writes in its place: the engine's own resolver turns the vocabulary into
// longhands, the compiler turns those into classes.

import { split } from '../../src/core/normalize.ts';
import { type CompiledRule, rulesOf } from './compile.ts';
import { Unstatic } from './module-scope.ts';

export interface CompiledLeaf {
  readonly values: Readonly<Record<string, unknown>>;
  readonly states?: Readonly<Record<string, Record<string, unknown>>>;
  readonly rules: readonly CompiledRule[];
}

function checkSerializable(value: unknown, at: string): void {
  if (value === null || value === undefined) return;
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return;
    case 'object':
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        checkSerializable(inner, `${at}.${key}`);
      }
      return;
    default:
      throw new Unstatic(`a ${typeof value} at ${at}`);
  }
}

function layer(longhands: Record<string, unknown>, at: string): CompiledRule[] {
  checkSerializable(longhands, at);
  return rulesOf(longhands);
}

/**
 * Compiles one declaration, or throws {@link Unstatic} for one only the
 * runtime can resolve: a value stated per breakpoint follows the design width
 * there, and nothing the build writes can.
 */
export function compileDeclaration(decl: Record<string, unknown>): CompiledLeaf {
  const piece = split(decl, 0);
  if (!piece) throw new Unstatic('an empty declaration');
  if (piece.breakpoints !== 0) throw new Unstatic('a value stated per breakpoint');
  const rules = layer(piece.rest, 'rest');
  const states: Record<string, Record<string, unknown>> = {};
  for (const name of piece.declared) {
    const coat = piece.states[name] ?? {};
    rules.push(...layer(coat, `_${name}`));
    states[name] = coat;
  }
  return { values: piece.rest, states: piece.declared.length > 0 ? states : undefined, rules };
}
