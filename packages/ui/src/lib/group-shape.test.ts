// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ring } from '#ui/core';
import { type GroupPosition, GroupSlotContext, groupSlot, useGroupShape } from './group-shape';

const at =
  (position: GroupPosition) =>
  ({ children }: { children: ReactNode }) =>
    createElement(GroupSlotContext.Provider, {
      value: groupSlot('horizontal', position, 12, 'md'),
      children,
    });

const inGroup = at('first');

describe('useGroupShape', () => {
  it('is null outside a group, so an ungrouped control keeps its own shape', () => {
    const { result } = renderHook(() => useGroupShape());
    expect(result.current).toBeNull();
  });

  it('drops the corners the member shares with the one after it', () => {
    const { result } = renderHook(() => useGroupShape(), { wrapper: inGroup });
    expect(result.current).toMatchObject({
      borderTopLeftRadius: 12,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    });
  });

  it('wears the ring INSIDE while it joins a neighbour, so it never lands on one', () => {
    const { result } = renderHook(() => useGroupShape(true), { wrapper: at('first') });

    expect(result.current).toMatchObject(ring.focusInset);
  });

  it('keeps the standing ring when it is the only member, which has an outside', () => {
    const { result } = renderHook(() => useGroupShape(true), { wrapper: at('only') });

    expect(result.current).not.toHaveProperty('outlineOffset');
  });
});
