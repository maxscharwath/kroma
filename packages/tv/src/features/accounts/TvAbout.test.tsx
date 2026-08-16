// @vitest-environment jsdom
//
// The About screen reads the set's own hardware live, through Web APIs a TV
// webview may or may not expose. What this pins: each row appears with the real
// number when its API answers, and hides - rather than printing a zero or an
// empty value - when the engine has nothing to say, which is the normal case on
// a native shell.

import { onScreen } from '@kroma/ui/testing';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvProvider } from '#tv/app/providers/env';
import { TvNavProvider } from '#tv/app/router';
import { TvAbout } from '#tv/features/accounts/TvAbout';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function withNavigator(extra: Record<string, unknown>) {
  vi.stubGlobal('navigator', { ...globalThis.navigator, userAgent: 'test', ...extra });
}

function mount(platform = 'Tizen') {
  render(
    onScreen(
      <EnvProvider platform={platform}>
        <TvNavProvider screens={{} as never}>
          <TvAbout />
        </TvNavProvider>
      </EnvProvider>,
    ),
  );
}

describe('TvAbout hardware rows', () => {
  it('names the running platform', () => {
    withNavigator({ hardwareConcurrency: 4 });
    mount('webOS');
    expect(screen.getByText('Platform')).toBeTruthy();
    expect(screen.getByText('webOS')).toBeTruthy();
  });

  it('shows the CPU core count when the engine reports it', () => {
    withNavigator({ hardwareConcurrency: 4 });
    mount();
    expect(screen.getByText('CPU')).toBeTruthy();
    expect(screen.getByText('4 cores')).toBeTruthy();
  });

  it('shows device memory in GB when Chromium reports it', () => {
    withNavigator({ hardwareConcurrency: 2, deviceMemory: 4 });
    mount();
    expect(screen.getByText('Memory')).toBeTruthy();
    expect(screen.getByText('4 GB')).toBeTruthy();
  });

  it('hides the CPU and memory rows when no API answers', () => {
    withNavigator({});
    vi.stubGlobal('performance', {});
    mount();
    expect(screen.queryByText('CPU')).toBeNull();
    expect(screen.queryByText('Memory')).toBeNull();
    // The platform row never depends on a Web API, so it still stands.
    expect(screen.getByText('Platform')).toBeTruthy();
  });
});
