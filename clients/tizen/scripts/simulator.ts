// Drives Samsung's TV web simulator over CDP, so a built package can be
// exercised in the Tizen `webapis`/`tizen` environment rather than a bare
// browser. What the simulator is NOT is an engine: it runs one bundled NW.js
// (Chromium 137 at the time of writing) whatever `--tizentvversion` says, and
// advertises a user-agent claiming Chrome 55. So it proves the package loads,
// paints and answers the remote; it can never prove an engine floor, and
// `check:legacy` remains the only thing that does.
//
// The simulator ignores `--file` unless its profile has never been started, so
// the app is loaded by pointing its viewport iframe at the built index.html,
// which is the same thing its installer would have done.

import { type ChildProcess, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const NWJS = join(homedir(), 'tizen-studio/tools/sec-tv-simulator/nwjs.app/Contents/MacOS/nwjs');

/** Which bundle the engine gate should be pushed into. */
export type Tier = 'modern' | 'legacy' | 'deep';

// The buttons on the simulator's own remote graphic. Pressing those rather than
// synthesising a key event is the whole point: the simulator posts what a
// television posts, a keyCode and no `key`, and an app that reads only
// `KeyboardEvent.key` is undrivable on any engine below Chrome 51.
const REMOTE_BUTTONS = {
  up: 'sc_2016_icon_bt_11_',
  down: 'sc_2016_icon_bt_12_',
  left: 'sc_2016_icon_bt_9_',
  right: 'sc_2016_icon_bt_10_',
  ok: 'sc_2016_icon_bt_8_',
} as const satisfies Record<string, string>;

export type RemoteKey = keyof typeof REMOTE_BUTTONS;

const Target = z.object({
  type: z.string(),
  url: z.string(),
  webSocketDebuggerUrl: z.string().optional(),
});
const Frame = z.object({
  id: z.number().optional(),
  method: z.string().optional(),
  result: z.unknown().optional(),
  params: z.unknown().optional(),
});
const Evaluated = z.object({
  result: z.object({ value: z.unknown().optional() }).optional(),
  exceptionDetails: z.unknown().optional(),
});
const Screenshot = z.object({ data: z.string() });
const Thrown = z.object({
  exceptionDetails: z.object({
    text: z.string().optional(),
    exception: z.object({ description: z.string().optional() }).optional(),
  }),
});

// Everything the gate probes, made to answer the way a set below that tier does.
const DISGUISE: Record<Tier, string> = {
  modern: '',
  legacy: 'delete window.CSSLayerBlockRule;',
  deep: `delete window.CSSLayerBlockRule;
    if (window.CSS && window.CSS.supports) {
      var real = window.CSS.supports.bind(window.CSS);
      window.CSS.supports = function () {
        return Array.prototype.join.call(arguments, ' ').indexOf('var(') === -1 &&
          real.apply(null, arguments);
      };
    }`,
};

// Reads back through the viewport iframe, which is where the app lives.
const inFrame = (body: string) => `
  (function () {
    var f = document.querySelector('iframe');
    var d = f.contentDocument, w = f.contentWindow;
    if (!d) return null;
    ${body}
  })()
`;

async function targets(port: number): Promise<z.infer<typeof Target>[]> {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  return z.array(Target).parse(await res.json());
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A running simulator. Always `close()` it: the process outlives the script. */
export class Simulator {
  private nextId = 0;
  private readonly pending = new Map<number, (value: unknown) => void>();
  private readonly thrown: string[] = [];

  private constructor(
    private readonly proc: ChildProcess,
    private readonly ws: WebSocket,
  ) {
    ws.onmessage = (event) => {
      const frame = Frame.safeParse(JSON.parse(String(event.data)));
      if (!frame.success) return;
      const { id, method, result, params } = frame.data;
      if (id !== undefined && this.pending.has(id)) {
        this.pending.get(id)?.(result);
        this.pending.delete(id);
        return;
      }
      if (method !== 'Runtime.exceptionThrown') return;
      const detail = Thrown.safeParse(params);
      if (detail.success) {
        const { text, exception } = detail.data.exceptionDetails;
        this.thrown.push(exception?.description ?? text ?? 'unknown exception');
      }
    };
  }

  static async launch({
    tizenVersion = '3.0',
    port = 9360,
    resolution = '1920x1080',
  }: {
    tizenVersion?: string;
    port?: number;
    resolution?: string;
  } = {}): Promise<Simulator> {
    const proc = spawn(
      NWJS,
      [
        '--platform',
        'tv',
        '--tizentvversion',
        tizenVersion,
        '--resolution',
        resolution,
        `--remote-debugging-port=${port}`,
      ],
      { stdio: 'ignore', detached: false },
    );

    const deadline = Date.now() + 40_000;
    let page: z.infer<typeof Target> | undefined;
    while (Date.now() < deadline) {
      await wait(700);
      page = await targets(port)
        .then((all) => all.find((t) => t.type === 'page' && t.url.includes('ripple.html')))
        .catch(() => undefined);
      if (page?.webSocketDebuggerUrl) break;
    }
    if (!page?.webSocketDebuggerUrl) {
      proc.kill();
      throw new Error(`simulator did not expose a CDP page on ${port}`);
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('simulator CDP socket refused'));
    });
    const sim = new Simulator(proc, ws);
    await sim.send('Page.enable');
    await sim.send('Runtime.enable');
    return sim;
  }

  private send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private async evaluate(expression: string): Promise<unknown> {
    const raw = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return Evaluated.parse(raw).result?.value;
  }

  /** Point the emulated screen at a built `index.html`, disguised as `tier`. */
  async load(indexHtml: string, tier: Tier): Promise<void> {
    await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { ${DISGUISE[tier]} } catch (e) {}`,
    });
    const url = JSON.stringify(`file://${indexHtml}`);
    await this.evaluate(
      `(function(){document.querySelector('iframe').src='about:blank';return 1})()`,
    );
    await wait(900);
    this.thrown.length = 0;
    await this.evaluate(`(function(){document.querySelector('iframe').src=${url};return 1})()`);
    await wait(7000);
  }

  /** Which bundle the gate actually chose, plus what it painted. */
  async inspect(): Promise<Record<string, unknown>> {
    const raw = await this.evaluate(
      inFrame(`
        var root = d.getElementById('root');
        var span = d.createElement('span');
        span.style.cssText = 'position:absolute;visibility:hidden;font-size:64px;white-space:nowrap';
        span.textContent = 'Who is watching?';
        var widthOf = function (family) {
          span.style.fontFamily = family;
          d.body.appendChild(span);
          var x = span.offsetWidth;
          span.remove();
          return x;
        };
        return JSON.stringify({
          scripts: [].slice.call(d.scripts).map(function (s) { return s.getAttribute('src'); }).filter(Boolean),
          stylesheets: [].slice.call(d.querySelectorAll('link[rel=stylesheet]')).map(function (l) { return l.getAttribute('href'); }),
          rootChars: root ? root.innerHTML.length : 0,
          bodyBackground: w.getComputedStyle(d.body).backgroundColor,
          tizen: typeof w.tizen,
          webapis: typeof w.webapis,
          cascadeLayers: typeof w.CSSLayerBlockRule,
          customProperties: w.CSS.supports('color', 'var(--k)'),
          webfontApplied: widthOf('"Hanken Grotesk"') !== widthOf('serif')
        });
      `),
    );
    return z.record(z.string(), z.unknown()).parse(JSON.parse(z.string().parse(raw)));
  }

  /** The label under the painted focus ring: the TV shell owns focus itself, so
   *  `document.activeElement` stays on `body` and says nothing. */
  async focusRing(): Promise<string> {
    const raw = await this.evaluate(
      inFrame(`
        var found = null;
        d.querySelectorAll('*').forEach(function (el) {
          var cs = w.getComputedStyle(el);
          if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 1) return;
          var text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text) found = text.slice(0, 60);
        });
        return found;
      `),
    );
    return typeof raw === 'string' ? raw : 'nothing focused';
  }

  /** Press one button on the simulator's remote, then let the shell settle. */
  async press(key: RemoteKey): Promise<void> {
    const raw = await this.evaluate(`
      (function () {
        var el = document.getElementById(${JSON.stringify(REMOTE_BUTTONS[key])});
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
      })()
    `);
    if (typeof raw !== 'string') throw new Error(`simulator remote has no ${key} button`);
    const { x, y } = z.object({ x: z.number(), y: z.number() }).parse(JSON.parse(raw));
    for (const type of ['mousePressed', 'mouseReleased'] as const) {
      await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
    await wait(900);
  }

  /** Uncaught exceptions since the last `load()`. */
  errors(): readonly string[] {
    return this.thrown;
  }

  async screenshot(path: string): Promise<void> {
    const raw = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(Screenshot.parse(raw).data, 'base64'));
  }

  close(): void {
    this.ws.close();
    this.proc.kill();
  }
}
