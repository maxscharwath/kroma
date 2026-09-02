import { describe, expect, it } from 'vitest';
import { depsWithoutMaps } from './deps-without-maps';

type Transform = (
  this: unknown,
  code: string,
  id: string,
) => { code: string; map: { mappings: string } } | undefined;

const transform = depsWithoutMaps().transform as Transform;

describe('depsWithoutMaps', () => {
  it('hands back a pre-bundled dependency unchanged, with an empty map', () => {
    const out = transform.call(null, 'export const z = 1;', '/app/node_modules/.vite/deps/zod.js');

    expect(out).toEqual({ code: 'export const z = 1;', map: { mappings: '' } });
  });

  it('leaves every other module to its own map', () => {
    expect(transform.call(null, 'x', '/app/src/main.tsx')).toBeUndefined();
    expect(transform.call(null, 'x', '/app/node_modules/zod/index.js')).toBeUndefined();
  });

  it('runs for the dev server only', () => {
    expect(depsWithoutMaps().apply).toBe('serve');
  });
});
