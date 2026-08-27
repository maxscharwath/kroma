// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { activeKeyInspector, installKeyInspector } from '../inspect';
import { mount } from './mount';

function chord(init: Partial<KeyboardEventInit> & { code: string }) {
  window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, ...init }));
}

afterEach(() => {
  installKeyInspector(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the dev-tools shortcut', () => {
  it('installs the key inspector on ctrl+alt+K and takes it off again', () => {
    const stop = mount();

    chord({ code: 'KeyK' });
    expect(activeKeyInspector()).not.toBeNull();
    chord({ code: 'KeyK' });

    expect(activeKeyInspector()).toBeNull();
    stop();
  });

  it('ignores the same key without both modifiers', () => {
    const stop = mount();

    chord({ code: 'KeyK', altKey: false });
    chord({ code: 'KeyK', ctrlKey: false });

    expect(activeKeyInspector()).toBeNull();
    stop();
  });

  it('ignores the modifiers on another key', () => {
    const stop = mount();

    chord({ code: 'KeyJ' });

    expect(activeKeyInspector()).toBeNull();
    stop();
  });

  it('stops listening once disposed, so a hot reload cannot stack listeners', () => {
    const stop = mount();

    stop();
    chord({ code: 'KeyK' });

    expect(activeKeyInspector()).toBeNull();
  });

  it('announces the same chord it listens for', () => {
    const banner = vi.spyOn(console, 'info').mockImplementation(() => {});

    const stop = mount();
    chord({ code: 'KeyK' });

    expect(activeKeyInspector()).not.toBeNull();
    expect(banner).toHaveBeenCalledWith(expect.stringContaining('ctrl+alt+K'));
    stop();
  });

  it('does nothing where there is no window, which is every prerender pass', () => {
    vi.stubGlobal('window', undefined);

    expect(() => mount()()).not.toThrow();
  });
});
