// @vitest-environment jsdom

import { cleanup, fireEvent, render as renderRaw, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onScreen } from '#ui/testing';
import { SegmentedControl } from './segmented-control';

const render = (ui: ReactElement) => renderRaw(onScreen(ui));

afterEach(cleanup);

// jsdom lays nothing out, so the seats every Item reports would all sit at x=0
// and the arrow order would be the mount order by accident. Placing them by
// hand is what makes "follows the row, not the mount order" testable at all.
function place(order: readonly string[]) {
  for (const [at, label] of order.entries()) {
    const el = screen.getByRole('radio', { name: label });
    const seat = el.parentElement;
    if (!seat) throw new Error(`no wrapper for ${label}`);
    fireEvent(
      seat,
      Object.assign(new Event('layout'), { nativeEvent: { layout: { x: at * 100, width: 100 } } }),
    );
  }
}

function Group({
  value,
  onValueChange,
  disabled,
}: Readonly<{ value: string; onValueChange: (v: string) => void; disabled?: string }>) {
  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={onValueChange}
      label="Mode"
      options={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: disabled === 'b' },
        { value: 'c', label: 'C' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a radiogroup whose segments carry the selection', () => {
    render(<Group value="a" onValueChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'B' }).getAttribute('aria-checked')).toBe('false');
  });

  it('steps over a disabled segment rather than selecting it', () => {
    const onValueChange = vi.fn();
    render(<Group value="a" onValueChange={onValueChange} disabled="b" />);
    place(['A', 'B', 'C']);

    fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Mode' }), { key: 'ArrowRight' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('c');
  });

  it('selects the next segment when nothing is disabled', () => {
    const onValueChange = vi.fn();
    render(<Group value="a" onValueChange={onValueChange} />);
    place(['A', 'B', 'C']);

    fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Mode' }), { key: 'ArrowRight' });

    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('wraps around the row backwards', () => {
    const onValueChange = vi.fn();
    render(<Group value="a" onValueChange={onValueChange} />);
    place(['A', 'B', 'C']);

    fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Mode' }), { key: 'ArrowLeft' });

    expect(onValueChange).toHaveBeenCalledWith('c');
  });
});
