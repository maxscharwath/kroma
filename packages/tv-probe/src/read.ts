import type { Page } from 'playwright';

export interface Reading {
  rings: number;
  ringed: string[];
  controls: number;
  nodes: number;
  overlaps: number;
  overlapping: string[];
}

export interface Frames {
  fps: number;
  worstFrame: number;
  jankyFrames: number;
  frameCount: number;
  responseP50: number;
  responseWorst: number;
}

const CONTROLS = '[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="switch"]';

// How long to wait for the observer to report on every control before reading
// what it has. The first callback normally carries them all.
const VISIBLE_MS = 300;

/** What the screen looks like right now, counted inside `#root` so a dev-only
 * overlay appended to `<body>` is never mistaken for the app. A ring is an
 * inline `outlineWidth`, the signal `focusable.test.tsx` reads; `ringed` names
 * what wears one, so a count above 1 says WHICH controls are lit.
 *
 * `overlaps` is the layout reading no unit test can take: jsdom measures
 * nothing, so a grid row that stacks its tiles down the screen instead of
 * across it passes every one of them and shows up only here. Buried rather
 * than merely overlapping: a rect on its own ignores the clip an ancestor puts
 * on it and whatever is painted over it, so a tile scrolled under the top bar
 * would read as a collision. The question is whether a control can still be
 * reached, which is what `elementFromPoint` answers at the middle of the part
 * still on screen. */
export async function read(page: Page): Promise<Reading> {
  return page.evaluate(
    async ({ controls, wait }) => {
      const root = document.getElementById('root') ?? document.body;
      const all = [...root.querySelectorAll<HTMLElement>('*')];
      const ringed = all.filter(
        (el) => el.style.outlineWidth !== '' && el.style.outlineWidth !== '0px',
      );
      const name = (el: HTMLElement) =>
        `${el.getAttribute('role') ?? el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? el.textContent ?? ''}`.slice(
          0,
          40,
        );

      const controlled = [...root.querySelectorAll<HTMLElement>(controls)];
      const onScreen = await new Promise<Array<{ el: HTMLElement; box: DOMRectReadOnly }>>(
        (resolve) => {
          if (controlled.length === 0) {
            resolve([]);
            return;
          }
          const seen = new Map<Element, DOMRectReadOnly>();
          const done = () => {
            observer.disconnect();
            resolve(
              controlled
                .map((el) => ({ el, box: seen.get(el) }))
                .filter((at): at is { el: HTMLElement; box: DOMRectReadOnly } => at.box != null),
            );
          };
          const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) seen.set(entry.target, entry.intersectionRect);
              else seen.delete(entry.target);
            }
            if (entries.length >= controlled.length) done();
          });
          for (const el of controlled) observer.observe(el);
          setTimeout(done, wait);
        },
      );

      const overlapping: string[] = [];
      let overlaps = 0;
      for (const { el, box } of onScreen) {
        const over = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!over || el === over || el.contains(over)) continue;
        overlaps += 1;
        if (overlapping.length < 6)
          overlapping.push(`${name(el)} under ${name(over as HTMLElement)}`);
      }

      return {
        rings: ringed.length,
        ringed: ringed.map(name),
        controls: controlled.length,
        nodes: all.length,
        overlaps,
        overlapping,
      };
    },
    { controls: CONTROLS, wait: VISIBLE_MS },
  );
}

/** The app's own frame counter (`packages/ui/src/lib/perf.ts`), or null where
 * the global is missing — which means the run measured nothing. */
export async function frames(page: Page): Promise<Frames | null> {
  return page.evaluate(() => {
    const perf = (globalThis as { KROMA_PERF?: { report(): Frames } }).KROMA_PERF;
    if (!perf) return null;
    const { fps, worstFrame, jankyFrames, frameCount, responseP50, responseWorst } = perf.report();
    return { fps, worstFrame, jankyFrames, frameCount, responseP50, responseWorst };
  });
}

export async function startFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const perf = (globalThis as { KROMA_PERF?: { reset(): void; start(): void } }).KROMA_PERF;
    perf?.reset();
    perf?.start();
  });
}
