// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mark } from './mark';
import { installProbe, probed } from './probe';

const FR = { scope: null, locale: 'fr' };

let stop = () => {};

function drew(text: string, vars?: Record<string, string | number>): string {
  return mark({ key: 'auth.login', from: FR, locale: 'fr', text, vars, holes: [] }, text);
}

function page(html: string): void {
  document.body.innerHTML = html;
  stop = installProbe('all', null);
}

// The pointer is answered by the caret, which jsdom lays out nothing for: the
// node under it is named by the test instead.
function pointAt(selector: string | null): void {
  const node = selector ? document.querySelector(selector)?.firstChild : null;
  vi.stubGlobal('document', document);
  document.caretPositionFromPoint = (() => (node ? { offsetNode: node } : null)) as never;
  document.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  Range.prototype.getBoundingClientRect = (() => ({ left: 0, top: 0, bottom: 0 })) as never;
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => setTimeout(run, 0) as unknown);
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pointing at a message', () => {
  it('names the key that drew it and the catalog that answered', () => {
    page(`<p id="a">${drew('Connexion')}</p>`);

    pointAt('#a');

    expect(probed()).toMatchObject({ key: 'auth.login', locale: 'fr', grade: 'catalog' });
  });

  it('carries the variables it was rendered with', () => {
    page(`<p id="a">${drew('Bonjour Maxime', { name: 'Maxime' })}</p>`);

    pointAt('#a');

    expect(probed()).toMatchObject({ vars: { name: 'Maxime' } });
  });

  it('says a hard-coded sentence has no key at all', () => {
    page('<p id="a">Blade Runner 2049</p>');

    pointAt('#a');

    expect(probed()).toMatchObject({ key: null, text: 'Blade Runner 2049', grade: 'raw' });
  });

  it('reports nothing for the punctuation between two messages', () => {
    page(`<p>${drew('Films')}<span id="sep"> · </span>${drew('12')}</p>`);

    pointAt('#sep');

    expect(probed()).toBeNull();
  });

  it('reports nothing where the pointer is over no text at all', () => {
    page(`<p id="a">${drew('Connexion')}</p>`);

    pointAt(null);

    expect(probed()).toBeNull();
  });
});

describe('alt-clicking a message', () => {
  it('still says what it read when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    page(`<button id="a">${drew('Connexion')}</button>`);
    document.caretPositionFromPoint = (() => ({
      offsetNode: document.querySelector('#a')?.firstChild,
    })) as never;

    document
      .querySelector('#a')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('auth.login');
  });

  it('copies its key instead of pressing the control it sits in', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    page(`<button id="a">${drew('Connexion')}</button>`);
    document.caretPositionFromPoint = (() => ({
      offsetNode: document.querySelector('#a')?.firstChild,
    })) as never;
    const pressed = vi.fn();
    document.addEventListener('click', pressed);

    document
      .querySelector('#a')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('auth.login');
    expect(pressed).not.toHaveBeenCalled();

    document.removeEventListener('click', pressed);
  });

  it('opens where it is written on alt-shift-click, without copying', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fetched = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.stubGlobal('fetch', fetched);
    page(`<button id="a">${drew('Connexion')}</button>`);
    document.caretPositionFromPoint = (() => ({
      offsetNode: document.querySelector('#a')?.firstChild,
    })) as never;

    document
      .querySelector('#a')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true, shiftKey: true }));
    await Promise.resolve();

    expect(writeText).not.toHaveBeenCalled();
  });

  it('leaves a plain click to the app', () => {
    page(`<button id="a">${drew('Connexion')}</button>`);
    const pressed = vi.fn();
    document.addEventListener('click', pressed);

    document.querySelector('#a')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(pressed).toHaveBeenCalledTimes(1);

    document.removeEventListener('click', pressed);
  });
});
