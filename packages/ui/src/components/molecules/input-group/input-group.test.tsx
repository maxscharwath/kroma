// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Txt } from '#ui/components/atoms/text';
import { InputGroup } from './input-group';

afterEach(cleanup);

function positionOf(text: string): number {
  const group = screen.getByRole('group');
  const found = [...group.querySelectorAll('*')].findIndex((node) => node.textContent === text);
  return found;
}

describe('<InputGroup>', () => {
  it('names the whole assembly, not the entry inside it', () => {
    render(
      <InputGroup.Root label="Amount">
        <InputGroup.Input placeholder="0.00" physicalKeyboard autoFocus={false} />
      </InputGroup.Root>,
    );
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Amount');
  });

  it('lays the addons out by `align`, not by the order they were written', () => {
    render(
      <InputGroup.Root label="Amount">
        {/* Deliberately back to front. */}
        <InputGroup.Addon align="inline-end">
          <Txt>USD</Txt>
        </InputGroup.Addon>
        <InputGroup.Input placeholder="0.00" physicalKeyboard autoFocus={false} />
        <InputGroup.Addon>
          <Txt>$</Txt>
        </InputGroup.Addon>
      </InputGroup.Root>,
    );
    expect(positionOf('$')).toBeLessThan(positionOf('USD'));
  });

  it('types into the entry when the padding beside it is pressed', () => {
    render(
      <InputGroup.Root label="Search">
        <InputGroup.Addon>
          <Txt>@</Txt>
        </InputGroup.Addon>
        <InputGroup.Input placeholder="Search" physicalKeyboard autoFocus={false} />
      </InputGroup.Root>,
    );
    const entry = screen.getByPlaceholderText('Search');
    expect(document.activeElement).not.toBe(entry);
    fireEvent.click(screen.getByText('@'));
    expect(document.activeElement).toBe(entry);
  });

  it("leaves an addon press of the caller's own working", () => {
    const onPress = vi.fn();
    render(
      <InputGroup.Root label="Search">
        <InputGroup.Input placeholder="Search" physicalKeyboard autoFocus={false} />
        <InputGroup.Addon align="inline-end" onPress={onPress}>
          <Txt>go</Txt>
        </InputGroup.Addon>
      </InputGroup.Root>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('refuses a part used outside the Root, rather than rendering something wrong', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <InputGroup.Addon>
          <Txt>$</Txt>
        </InputGroup.Addon>,
      ),
    ).toThrow(/InputGroup.Addon/);
    quiet.mockRestore();
  });
});
