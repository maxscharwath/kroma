// The neighbour table that feeds tvOS's own focus guides.
//
// The rules here are all mount-order rules, and each one was a bug on an Apple
// TV first: a neighbour named before it exists resolves to nothing, and a
// `nextFocus*` prop set to nothing on the first render never changes again, so
// the guide is never built. Hence the subscription - and hence these tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announceRegistered,
  crossingTarget,
  declareEntry,
  onRegistryChange,
  screenEntry,
} from './focus-crossings';

/** A control's host view; identity is all the table uses it for. */
const view = (name: string) => ({ view: name });

describe('crossings', () => {
  beforeEach(() => {
    for (const id of ['a', 'b', 'c']) declareEntry(id, null, false);
  });

  it('resolves a ref to whatever it holds', () => {
    const node = view('b');
    expect(crossingTarget({ current: node })).toBe(node);
  });

  it('resolves to nothing while the neighbour has not mounted', () => {
    expect(crossingTarget({ current: null })).toBeNull();
    expect(crossingTarget(undefined)).toBeNull();
  });

  it('sends `screenEntry` to the control that declared itself the entry point', () => {
    const entry = view('entry');
    declareEntry('a', entry, true);
    expect(crossingTarget(screenEntry)).toBe(entry);
  });

  it('prefers the innermost entry point, so a sheet over a page owns it', () => {
    const page = view('page');
    const sheet = view('sheet');
    declareEntry('a', page, true);
    declareEntry('b', sheet, true);
    expect(crossingTarget(screenEntry)).toBe(sheet);

    // The sheet closes: the page's own entry answers again.
    declareEntry('b', null, false);
    expect(crossingTarget(screenEntry)).toBe(page);
  });

  it('resolves `screenEntry` to nothing when no screen has declared one', () => {
    expect(crossingTarget(screenEntry)).toBeNull();
  });

  it('wakes the namers when a control registers, so a null ref is resolved again', () => {
    const listener = vi.fn();
    const stop = onRegistryChange(listener);

    announceRegistered();
    expect(listener).toHaveBeenCalledTimes(1);

    declareEntry('a', view('a'), true);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    announceRegistered();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stays silent while nobody is naming anyone', () => {
    // Every control announces its mount; a screenful of them must not cost
    // anything when no crossing is declared.
    expect(() => announceRegistered()).not.toThrow();
  });
});
