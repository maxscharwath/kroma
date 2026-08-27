// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  renderHook,
  render as renderRaw,
  screen,
} from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '#ui/components/atoms/button';
import { Text } from '#ui/components/atoms/text';
import { onScreen } from '#ui/testing';
import { Stepper, useStepper, useStepperItem } from './stepper';

const render = (ui: ReactElement) => renderRaw(onScreen(ui));

afterEach(cleanup);

function Flow({ children }: Readonly<{ children?: ReactNode }>) {
  return (
    <Stepper.Root label="Configuration">
      <Stepper.List>
        <Stepper.Item value="account">
          <Stepper.Label>Compte</Stepper.Label>
        </Stepper.Item>
        <Stepper.Item value="library">
          <Stepper.Label>Bibliothèque</Stepper.Label>
        </Stepper.Item>
        <Stepper.Item value="done">
          <Stepper.Label>Fin</Stepper.Label>
        </Stepper.Item>
      </Stepper.List>
      <Stepper.Panel value="account">
        <Text>Adresse</Text>
      </Stepper.Panel>
      {children}
      <Stepper.Previous />
      <Stepper.Next />
    </Stepper.Root>
  );
}

function Footer() {
  const flow = useStepper();
  return <Text>{`${flow.index + 1}/${flow.count}`}</Text>;
}

describe('useStepper', () => {
  it('hands anything inside the Root the flow it is running', () => {
    render(
      <Flow>
        <Footer />
      </Flow>,
    );

    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('names itself when it is called outside a Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useStepper())).toThrow(
      '<Stepper.useStepper> must be used inside <Stepper.Root>',
    );

    vi.restoreAllMocks();
  });
});

function Dot({ value }: Readonly<{ value: string }>) {
  const step = useStepperItem(value);
  return (
    <Button
      label={`${value} ${step.index} ${step.complete ? 'done' : 'todo'}`}
      disabled={!step.reachable}
      onPress={step.select}
    />
  );
}

describe('useStepperItem', () => {
  it('answers for one step, and goes to it when a hand-drawn indicator is pressed', () => {
    render(
      <Flow>
        <Dot value="account" />
      </Flow>,
    );

    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.click(screen.getByLabelText('account 0 done'));

    expect(screen.getByText('Adresse')).toBeTruthy();
  });

  it('names itself when it is called outside a Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useStepperItem('account'))).toThrow(
      '<Stepper.useStepperItem> must be used inside <Stepper.Root>',
    );

    vi.restoreAllMocks();
  });
});
