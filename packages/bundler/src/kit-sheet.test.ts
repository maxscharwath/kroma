import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { writeKitSheet } from './kit-sheet';

const roots: string[] = [];

const BORDER =
  '.r-b2{border-top-color:rgba(0,0,0,1.00);border-right-color:rgba(0,0,0,1.00);' +
  'border-bottom-color:rgba(0,0,0,1.00);border-left-color:rgba(0,0,0,1.00);}';

const WORKER = `
const border = ${JSON.stringify(BORDER)};
const sheets = {
  '/browse': '[stylesheet-group="0"]{}\\n.r-a1{color:red;}\\n[stylesheet-group="2"]{}\\n' + border,
  '/detail':
    '[stylesheet-group="0"]{}\\n.r-a1{color:red;}\\n[stylesheet-group="2"]{}\\n' +
    border +
    '\\n.css-c3{color:teal;}',
};
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.redirect(url.origin + '/browse', 302);
    if (url.pathname === '/all.json') {
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }
    const extra = env && env.TOKEN ? '\\n.token{color:gold;}' : '';
    const body =
      '<html><head><style id="react-native-stylesheet">' +
      (sheets[url.pathname] ?? '') +
      extra +
      '</style></head><body class="r-a1"><div class="r-b2 token"></div>' +
      '<a href="/detail">d</a><a href="/all.json">j</a>' +
      '<a href="https://elsewhere.test/x">o</a></body></html>';
    return new Response(body, { headers: { 'content-type': 'text/html' } });
  },
};
`;

function site(chunk: string): { serverDir: string; clientDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'kroma-kit-sheet-'));
  roots.push(root);
  const serverDir = join(root, 'server');
  const clientDir = join(root, 'client');
  mkdirSync(serverDir, { recursive: true });
  mkdirSync(clientDir, { recursive: true });
  writeFileSync(join(serverDir, 'entry.mjs'), WORKER);
  writeFileSync(join(serverDir, 'chunk.js'), chunk);
  return { serverDir, clientDir };
}

const SLOTS = `const BUILT = { href: '__KROMA_KIT_SHEET_HREF__', css: '__KROMA_KIT_SHEET_CSS__' };`;

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('writeKitSheet', () => {
  it('renders every page the links reach and keeps the widest sheet', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs' });

    expect(built.rendered).toEqual(['/', '/detail']);
    expect(built.css).toContain('.css-c3{color:teal;}');
    expect(built.css).toContain('[stylesheet-group="2"]{}');
    expect(readFileSync(join(dirs.clientDir, built.name), 'utf8')).toBe(built.file);
    expect(built.name).toMatch(/^assets\/kit-[0-9a-f]{8}\.css$/);
  });

  it('squeezes the file without losing a class', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs' });

    expect(built.file.length).toBeLessThan(built.css.length);
    expect(built.file).not.toContain('[stylesheet-group=');
    expect(built.file).not.toContain('border-top-color');
    expect(built.file).toContain('border-color:#000');
    for (const name of ['.r-a1', '.r-b2']) expect(built.file).toContain(name);
  });

  it('leaves out a rule no page wore, in the file and in the slot alike', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs' });
    const chunk = readFileSync(join(dirs.serverDir, 'chunk.js'), 'utf8');

    expect(built.css).toContain('.css-c3{color:teal;}');
    expect(built.held).not.toContain('.css-c3');
    expect(built.file).not.toContain('.css-c3');
    expect(chunk).not.toContain('.css-c3');
  });

  it('fills the slots the runtime holds for the file', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs', base: '/' });
    const chunk = readFileSync(join(dirs.serverDir, 'chunk.js'), 'utf8');

    expect(chunk).toContain(`href: "/${built.name}"`);
    expect(chunk).toContain('[stylesheet-group=\\"2\\"]{}');
    expect(chunk).toContain('border-top-color');
    expect(chunk).not.toContain('__KROMA_KIT_SHEET');
  });

  it('hands the render the bindings it was given', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs', env: { TOKEN: 'x' } });

    expect(built.css).toContain('.token{color:gold;}');
  });

  it('stops at the page limit', async () => {
    const dirs = site(SLOTS);
    const built = await writeKitSheet({ ...dirs, entry: 'entry.mjs', limit: 1 });

    expect(built.rendered).toEqual(['/']);
  });

  it('fails the build when the runtime holds no slot to fill', async () => {
    const dirs = site('const nothing = 1;');

    await expect(writeKitSheet({ ...dirs, entry: 'entry.mjs' })).rejects.toThrow(
      '__KROMA_KIT_SHEET_HREF__ is missing',
    );
  });

  it('fails the build when no page compiled a sheet', async () => {
    const dirs = site(SLOTS);

    await expect(
      writeKitSheet({ ...dirs, entry: 'entry.mjs', entries: ['/all.json'] }),
    ).rejects.toThrow('compiled no stylesheet');
  });
});
