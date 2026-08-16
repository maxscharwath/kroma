import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenCustomProperties, syntaxAboveDeepFloor } from './deep-tier';

function sheet(css: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'kroma-deep-')), 'style.css');
  writeFileSync(path, css);
  return path;
}

describe('syntaxAboveDeepFloor', () => {
  it('passes the ES5 and M47-era syntax Babel leaves alone', () => {
    const code = 'var a = function (x) { return `t${x}`; };for (var k of []) a(k);';
    expect(syntaxAboveDeepFloor(code)).toEqual([]);
  });

  it.each([
    ['let x = 1;', 'let declaration'],
    ['const x = 1;', 'const declaration'],
    ['var C = class {};', 'class'],
    ['var { a } = b;', 'destructuring'],
    ['function f(a = 1) {}', 'default parameter'],
  ])('flags %j', (code, expected) => {
    expect(syntaxAboveDeepFloor(code)).toContain(expected);
  });

  it('does not flag generated code sitting in a string literal', () => {
    const code = 'var w = "const input = payload.value;";var y = "class Foo {}";';
    expect(syntaxAboveDeepFloor(code)).toEqual([]);
  });
});

describe('flattenCustomProperties', () => {
  it('resolves against the pinned theme and drops the definitions', async () => {
    const path = sheet(':root,[data-theme=dark]{--bg:#000}.a{color:var(--bg)}');
    await flattenCustomProperties(path, 'dark');
    expect(readFileSync(path, 'utf8')).toBe('.a{color:#000}');
  });

  it('drops the themes it is not shipping', async () => {
    const path = sheet(
      ':root,[data-theme=dark]{--bg:#000}[data-theme=light]{--bg:#fff}.a{color:var(--bg)}',
    );
    await flattenCustomProperties(path, 'dark');
    const css = readFileSync(path, 'utf8');
    expect(css).toContain('#000');
    expect(css).not.toContain('#fff');
  });

  it('drops a prefers-color-scheme block for another theme', async () => {
    const path = sheet(
      ':root{--bg:#000}@media (prefers-color-scheme:light){:root{--bg:#fff}}.a{color:var(--bg)}',
    );
    await flattenCustomProperties(path, 'dark');
    expect(readFileSync(path, 'utf8')).toBe('.a{color:#000}');
  });

  it('resolves a property defined through another property', async () => {
    const path = sheet(':root{--ink:#0a0a0c;--text:var(--ink)}.a{color:var(--text)}');
    await flattenCustomProperties(path, 'dark');
    expect(readFileSync(path, 'utf8')).toBe('.a{color:#0a0a0c}');
  });

  it('keeps a descendant selector scoped to the pinned theme', async () => {
    const path = sheet(':root{--bg:#000}[data-theme=dark] .a{color:var(--bg)}');
    await flattenCustomProperties(path, 'dark');
    expect(readFileSync(path, 'utf8')).toBe('.a{color:#000}');
  });

  it('throws rather than emit a sheet an engine below M49 would drop', async () => {
    const path = sheet('.a{color:var(--never-defined)}');
    await expect(flattenCustomProperties(path, 'dark')).rejects.toThrow('--never-defined');
  });
});
