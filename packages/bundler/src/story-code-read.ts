// A story's identity, read out of its `.story.mdx` at BUILD time.
//
// The workbench's lazy index lists every component before executing any of
// them, and a story names itself inside `defineStory({ ... })`, in an ESM block
// the TypeScript project never sees. The two literals the index needs are read
// off the compiled module with acorn (the compile has already turned the JSX
// into calls), and a file that cannot be read ships nothing rather than failing
// the build - which is also what every Metro build sees.

import { relative, sep } from 'node:path';

/** What the build knows about one story file: the `name` and `group` a
 *  workbench needs to LIST it without running the module that draws it. Mirrors
 *  `StoryCode` in @kroma/workbench; kept structural rather than imported so
 *  this build-time module has no runtime dependency on the package. */
export interface StoryCode {
  name?: string;
  group?: string;
}

/** Every story file's identity, keyed by repository-relative path - the one
 *  spelling both bundlers' globs can be reduced to. */
export type StoryCodes = Record<string, StoryCode>;

const keyOf = (repo: string, fileName: string): string =>
  relative(repo, fileName).split(sep).join('/');

async function mdxIdentity(fileName: string): Promise<StoryCode | null> {
  const [{ readFile }, { compileMdx }, { Parser }] = await Promise.all([
    import('node:fs/promises'),
    import('./mdx.mjs'),
    import('acorn'),
  ]);
  const text = await readFile(fileName, 'utf8').catch(() => null);
  if (text === null) return null;
  let program: ReturnType<typeof Parser.parse>;
  try {
    const compiled = await compileMdx(text, fileName);
    program = Parser.parse(compiled, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch {
    return null;
  }
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declared of declaration.declarations) {
      if (declared.id.type !== 'Identifier' || declared.id.name !== 'story') continue;
      const definition =
        declared.init?.type === 'CallExpression' ? declared.init.arguments[0] : declared.init;
      if (definition?.type !== 'ObjectExpression') return null;
      const wordOf = (name: string): string | undefined => {
        for (const entry of definition.properties) {
          if (entry.type !== 'Property' || entry.computed) continue;
          if (entry.key.type !== 'Identifier' || entry.key.name !== name) continue;
          if (entry.value.type === 'Literal' && typeof entry.value.value === 'string') {
            return entry.value.value;
          }
        }
        return undefined;
      };
      const name = wordOf('name');
      const group = wordOf('group');
      if (!name && !group) return null;
      return { ...(name ? { name } : null), ...(group ? { group } : null) };
    }
  }
  return null;
}

/** What every `.story.mdx` declares about itself - the `name` and `group` an
 * index lists it by - keyed by repository-relative path. */
export async function readStoryMdxCode(
  repo: string,
  files: readonly string[],
): Promise<StoryCodes> {
  const out: StoryCodes = {};
  const read = await Promise.all(files.map(mdxIdentity));
  for (const [at, code] of read.entries()) {
    const file = files[at];
    if (code && file) out[keyOf(repo, file)] = code;
  }
  return out;
}
