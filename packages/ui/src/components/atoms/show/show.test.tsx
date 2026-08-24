// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Show } from './show';

describe('Show', () => {
  it('renders children when `when` is truthy', () => {
    render(
      <Show when={1}>
        <span>on</span>
      </Show>,
    );
    expect(screen.getByText('on')).toBeTruthy();
  });

  it('renders the fallback when `when` is falsy', () => {
    render(
      <Show when={0} fallback={<span>off</span>}>
        <span>on</span>
      </Show>,
    );
    expect(screen.queryByText('on')).toBeNull();
    expect(screen.getByText('off')).toBeTruthy();
  });

  it('renders nothing when falsy with no fallback', () => {
    const { container } = render(
      <Show when={false}>
        <span>on</span>
      </Show>,
    );
    expect(container.textContent).toBe('');
  });

  it('takes only the active branch when branches are thunks', () => {
    const taken = vi.fn(() => <span>on</span>);
    const skipped = vi.fn(() => <span>off</span>);
    render(
      <Show when fallback={skipped}>
        {taken}
      </Show>,
    );
    expect(taken).toHaveBeenCalledTimes(1);
    expect(skipped).not.toHaveBeenCalled();
    expect(screen.getByText('on')).toBeTruthy();
  });
});
