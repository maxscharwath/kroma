import { describe, expect, it } from 'vitest';
import { withKitStyles } from './ssr';

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
