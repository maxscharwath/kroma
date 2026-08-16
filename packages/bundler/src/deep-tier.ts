// The deep legacy tier (Chromium 47: Tizen 3.0, the 2017 sets). Two post-build
// passes the ordinary legacy tier does not need, both run on the emitted files
// so they see the final bundle whatever the plugin order was:
//
//  1. Babel lowers the JS to the tier's floor. rolldown emits es2015 and esbuild
//     refuses to lower block scoping at all, so Babel is the only transpiler in
//     the repo that reaches M47. The explicit class transform is not redundant
//     with preset-env: the bundle is a sloppy-mode IIFE, where `class` is M49,
//     not the M42 preset-env assumes from strict-mode module semantics.
//
//  2. Custom properties are resolved to literals. They are M49, and no
//     down-level pass emits a fallback for them, so on a 2017 set every
//     declaration reading one is dropped and the app paints unstyled. The shell
//     pins a theme on <html>, so the values are static: one flattened stylesheet
//     replaces the cascade that carried them.

import { readFileSync, writeFileSync } from 'node:fs';
import { transformAsync } from '@babel/core';
import transformClasses from '@babel/plugin-transform-classes';
import presetEnv from '@babel/preset-env';
import { parse } from 'acorn';
import postcss from 'postcss';
import customProperties from 'postcss-custom-properties';

const THEME_ATTR = /\[data-theme\s*=\s*["']?([\w-]+)["']?\]/g;
const COLOR_SCHEME = /prefers-color-scheme\s*:\s*([\w-]+)/;

/** Lowers `path` in place to `chrome`, the tier's Chromium floor. */
export async function lowerJs(path: string, chrome: number): Promise<void> {
  const out = await transformAsync(readFileSync(path, 'utf8'), {
    filename: path,
    babelrc: false,
    configFile: false,
    compact: true,
    sourceMaps: false,
    // Modules, not names: babel resolves a named plugin from the cwd, which
    // during a build is the shell's directory rather than this package's.
    presets: [[presetEnv, { targets: { chrome: String(chrome) }, modules: false }]],
    plugins: [transformClasses],
  });
  if (!out?.code) throw new Error(`deep-tier: babel produced no output for ${path}`);
  writeFileSync(path, out.code);
}

function walk(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.type === 'string') visit(record);
  for (const key of Object.keys(record)) {
    if (key !== 'type') walk(record[key], visit);
  }
}

/** Names the syntax in `code` that Chromium 47 cannot parse, empty when there is
 * none. An AST walk rather than a scan: this bundle carries generated code as
 * string literals (zod writes `const ...` into one), and a regex reads those as
 * real declarations. Everything listed is M49; what M47 does have, and Babel
 * therefore leaves alone, is arrow functions, template literals, generators,
 * for-of, computed keys and shorthand. */
export function syntaxAboveDeepFloor(code: string): string[] {
  const found = new Set<string>();
  const ast = parse(code, {
    ecmaVersion: 2022,
    sourceType: 'script',
    allowReturnOutsideFunction: true,
  });
  walk(ast, (node) => {
    if (node.type === 'VariableDeclaration' && (node.kind === 'let' || node.kind === 'const')) {
      found.add(`${node.kind} declaration`);
    } else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      found.add('class');
    } else if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
      found.add('destructuring');
    } else if (node.type === 'AssignmentPattern') {
      found.add('default parameter');
    }
  });
  return [...found];
}

// Rewrites one selector for the pinned theme: parts naming another theme drop
// out, parts naming this one lose the attribute. Returns null when nothing is
// left, i.e. the whole rule belonged to a theme this build does not ship.
function pinSelector(selector: string, theme: string): string | null {
  const kept = selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const named = [...part.matchAll(THEME_ATTR)].map((m) => m[1]);
      if (named.length === 0) return [part];
      if (named.some((name) => name !== theme)) return [];
      const bare = part.replace(THEME_ATTR, '').trim();
      return [bare === '' ? ':root' : bare];
    });
  return kept.length > 0 ? [...new Set(kept)].join(',') : null;
}

/** Resolves every `var()` in `path` against `theme`, in place. Throws rather
 * than emit a stylesheet an engine below M49 would drop declarations from. */
export async function flattenCustomProperties(path: string, theme: string): Promise<void> {
  const root = postcss.parse(readFileSync(path, 'utf8'), { from: path });

  root.walkAtRules('media', (at) => {
    const scheme = COLOR_SCHEME.exec(at.params)?.[1];
    if (!scheme) return;
    if (scheme === theme) at.replaceWith(at.nodes ?? []);
    else at.remove();
  });
  root.walkRules((rule) => {
    const pinned = pinSelector(rule.selector, theme);
    if (pinned === null) rule.remove();
    else rule.selector = pinned;
  });

  const out = await postcss([customProperties({ preserve: false })]).process(root, {
    from: path,
    map: false,
  });

  // Substitution leaves the definitions behind, including the ones whose value
  // is itself a var(). An engine below M49 parses none of them, so they are
  // weight at best; dropping them also makes the guard below exact.
  out.root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) decl.remove();
  });
  out.root.walkRules((rule) => {
    if (rule.nodes.length === 0) rule.remove();
  });
  out.root.walkAtRules((at) => {
    if ((at.nodes?.length ?? 0) === 0) at.remove();
  });

  const css = out.root.toString();
  const unresolved = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
  if (unresolved.length > 0) {
    throw new Error(
      `deep-tier: ${unresolved.length} custom properties unresolved in ${path} (${unresolved.slice(0, 6).join(', ')})`,
    );
  }
  writeFileSync(path, css);
}
