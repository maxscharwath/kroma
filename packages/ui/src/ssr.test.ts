import { StyleSheet } from 'react-native';
import { describe, expect, it } from 'vitest';
import { withKitStyles } from './ssr';

const live = () =>
  (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet().textContent;

// Compiles one declaration the way a render does, and answers with the class
// react-native-web minted for it.
const compile = (style: Record<string, unknown>): string => {
  const sheet = StyleSheet.create({ one: style });
  const [className] = (StyleSheet as unknown as (styles: unknown[]) => [string, unknown])([
    sheet.one,
  ]);
  return className;
};

const page = (body: string, init?: ResponseInit) =>
  new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });

const get = () => new Request('https://packages.kroma.tv/browse');

describe('withKitStyles', () => {
  it('inlines the compiled stylesheet before the head closes', async () => {
    const served = withKitStyles(() => page('<html><head><title>x</title></head><body>y</body>'));
    const html = await (await served(get())).text();

    expect(html).toContain('<style id="react-native-stylesheet">');
    expect(html.indexOf('<style')).toBeLessThan(html.indexOf('</head>'));
    expect(html).toContain('<body>y</body>');
  });

  it('links the built file and inlines what it does not hold, under its group marker', async () => {
    const held = live().split('\n');
    const markers = held.filter((rule) => rule.startsWith('[stylesheet-group='));
    const marker = markers[markers.length - 1] as string;
    const missing = held[held.length - 1] as string;
    const file = { href: '/assets/kit-abcd1234.css', css: held.slice(0, -1).join('\n') };
    const served = withKitStyles(() => page('<html><head></head><body>y</body>'), file);
    const response = await served(get());
    const html = await response.text();

    expect(marker).toContain('[stylesheet-group=');
    expect(html).toContain('<link rel="stylesheet" href="/assets/kit-abcd1234.css">');
    expect(html).toContain(`<style id="react-native-stylesheet">${marker}\n${missing}</style>`);
    expect(response.headers.get('x-kroma-kit-delta')).toBe(String(`${marker}\n${missing}`.length));
  });

  it('inlines nothing when the built file holds the whole sheet', async () => {
    const file = { href: '/assets/kit-abcd1234.css', css: live() };
    const served = withKitStyles(() => page('<html><head></head><body>y</body>'), file);
    const response = await served(get());

    expect(await response.text()).toContain(
      '<link rel="stylesheet" href="/assets/kit-abcd1234.css"><style id="react-native-stylesheet"></style>',
    );
    expect(response.headers.get('x-kroma-kit-delta')).toBe('0');
  });

  it('inlines a missing rule only when the page is wearing its class', async () => {
    const held = live();
    const worn = compile({ backgroundColor: 'rgb(9,9,9)' });
    const idle = compile({ backgroundColor: 'rgb(8,8,8)' });
    const file = { href: '/assets/kit-abcd1234.css', css: held };
    const served = withKitStyles(
      () => page(`<html><head></head><body><div class="${worn}">y</div></body>`),
      file,
    );
    const html = await (await served(get())).text();
    const inlined = /<style id="react-native-stylesheet">([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

    expect(inlined).toContain(`.${worn}{background-color:rgba(9,9,9,1.00);}`);
    expect(inlined).toContain('[stylesheet-group=');
    expect(inlined).not.toContain(idle);
  });

  it('leaves a response that is not a document alone', async () => {
    const json = new Response('{"packages":[]}', {
      headers: { 'content-type': 'application/json' },
    });
    const served = withKitStyles(() => json);

    expect(await served(get())).toBe(json);
  });

  it('keeps the status and the headers the handler set', async () => {
    const served = withKitStyles(() =>
      page('<html><head></head><body>gone</body>', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'text/html', 'cache-control': 'max-age=60' },
      }),
    );
    const response = await served(get());

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('max-age=60');
    expect(response.headers.get('content-length')).toBeNull();
  });
});
