import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const PRESS = /\bon(?:Press|LongPress|Select|Click)\s*=\s*\{/g;

const DESTINATION = /\bto:\s*'([^']+)'/;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = join(dir, entry.name);
    if (entry.isDirectory()) sources(at, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|fixture)\./.test(entry.name)) out.push(at);
  }
  return out;
}

function braced(source: string, open: number): string {
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    else if (source[at] === '}' && --depth === 0) return source.slice(open + 1, at);
  }
  return source.slice(open);
}

function statementAt(source: string, from: number): string {
  let depth = 0;
  for (let at = from; at < source.length; at++) {
    const char = source[at] ?? '';
    if ('({['.includes(char)) depth++;
    else if (')}]'.includes(char)) depth--;
    else if (char === ';' && depth === 0) return source.slice(from, at);
  }
  return source.slice(from);
}

function handlerOf(source: string, written: string): string {
  const name = /^[A-Za-z_$][\w$]*$/.exec(written.trim())?.[0];
  if (!name) return written;
  const declared = new RegExp(`\\bconst ${name}\\s*=`).exec(source);
  return declared ? statementAt(source, declared.index) : '';
}

function pressHandlersThatNavigate(): string[] {
  const found: string[] = [];
  for (const file of sources(ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const press of source.matchAll(PRESS)) {
      const handler = handlerOf(source, braced(source, press.index + press[0].length - 1));
      if (!/\bnavigate\(/.test(handler)) continue;
      found.push(`${relative(ROOT, file)} -> ${DESTINATION.exec(handler)?.[1] ?? 'unknown'}`);
    }
  }
  return found.sort();
}

describe('a control that goes somewhere', () => {
  it('is a link rather than a press handler that navigates', () => {
    const offenders = pressHandlersThatNavigate();

    expect(offenders).toEqual([]);
  });
});
