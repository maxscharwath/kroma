// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { If } from './if';

describe('If', () => {
  it('renders children when the condition is truthy', () => {
    render(
      <If condition={1}>
        <span>on</span>
      </If>,
    );
    expect(screen.getByText('on')).toBeTruthy();
  });

  it('renders the fallback when the condition is falsy', () => {
    render(
      <If condition={0} fallback={<span>off</span>}>
        <span>on</span>
      </If>,
    );
    expect(screen.queryByText('on')).toBeNull();
    expect(screen.getByText('off')).toBeTruthy();
  });

  it('renders nothing when falsy with no fallback', () => {
    const { container } = render(
      <If condition={false}>
        <span>on</span>
      </If>,
    );
    expect(container.textContent).toBe('');
  });

  it('takes only the active branch when branches are thunks', () => {
    const taken = vi.fn(() => <span>on</span>);
    const skipped = vi.fn(() => <span>off</span>);
    render(
      <If condition fallback={skipped}>
        {taken}
      </If>,
    );
    expect(taken).toHaveBeenCalledTimes(1);
    expect(skipped).not.toHaveBeenCalled();
    expect(screen.getByText('on')).toBeTruthy();
  });
});
