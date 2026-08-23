const SPECIAL = /[.+^$()|[\]\\]/g;

function alternatives(body: string): string {
  return `(?:${body.split(',').map(translate).join('|')})`;
}

function translate(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) throw new Error(`unclosed brace in '${glob}'`);
      out += alternatives(glob.slice(i + 1, end));
      i = end;
    } else if (ch === '*' && glob[i + 1] === '*') {
      const slashAfter = glob[i + 2] === '/';
      out += slashAfter ? '(?:.*/)?' : '.*';
      i += slashAfter ? 2 : 1;
    } else if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += (ch ?? '').replace(SPECIAL, '\\$&');
    }
  }
  return out;
}

/**
 * Compiles one path glob. `**` spans directories, `*` and `?` stop at a slash,
 * `{a,b}` is a choice. Matches the whole path, never a substring.
 */
export function compile(glob: string): RegExp {
  return new RegExp(`^${translate(glob)}$`);
}

/** Whether `path` matches any of `globs`. */
export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => compile(glob).test(path));
}
