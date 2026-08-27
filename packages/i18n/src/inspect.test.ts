import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeKeyInspector,
  inspectorRevision,
  installKeyInspector,
  onKeyInspectorChange,
} from './inspect';

afterEach(() => {
  installKeyInspector(null);
});

describe('the key inspector slot', () => {
  it('holds nothing until one is installed', () => {
    expect(activeKeyInspector()).toBeNull();
  });

  it('hands back the inspector it was given, and drops it again', () => {
    const inspector = vi.fn(() => 'label');

    installKeyInspector(inspector);
    expect(activeKeyInspector()).toBe(inspector);
    installKeyInspector(null);

    expect(activeKeyInspector()).toBeNull();
  });

  it('moves its revision on every install, so a snapshot of it changes', () => {
    const before = inspectorRevision();

    installKeyInspector(() => 'label');

    expect(inspectorRevision()).toBeGreaterThan(before);
  });

  it('announces an install to a listener until it unsubscribes', () => {
    const listener = vi.fn();

    const stop = onKeyInspectorChange(listener);
    installKeyInspector(() => 'label');
    stop();
    installKeyInspector(null);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
