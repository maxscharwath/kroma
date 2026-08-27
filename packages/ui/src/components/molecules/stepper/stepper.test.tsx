// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  renderHook,
  render as renderRaw,
  screen,
} from '@testing-library/react';
import { act, type ReactElement, type ReactNode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '#ui/components/atoms/button';
import { Text } from '#ui/components/atoms/text';
import { onScreen } from '#ui/testing';
import {
  Stepper,
  type StepperRootProps,
  useStepper,
  useStepperItem,
  useSteps,
} from './stepper';

const render = (ui: ReactElement) => renderRaw(onScreen(ui));

afterEach(cleanup);

function Flow({
  children,
  ...root
}: Readonly<Partial<StepperRootProps> & { children?: ReactNode }>) {
  return (
    <Stepper.Root label="Configuration" {...root}>
      <Stepper.List>
        <Stepper.Item value="account">
          <Stepper.Label>Compte</Stepper.Label>
        </Stepper.Item>
        <Stepper.Item value="library" disabled={root.value === 'skip'}>
          <Stepper.Label>Bibliothèque</Stepper.Label>
        </Stepper.Item>
        <Stepper.Item value="done">
          <Stepper.Label>Fin</Stepper.Label>
        </Stepper.Item>
      </Stepper.List>
      <Stepper.Panel value="account">
        <Text>Adresse</Text>
      </Stepper.Panel>
      <Stepper.Panel value="library">
        <Text>Dossiers</Text>
      </Stepper.Panel>
      <Stepper.Panel value="done">
        <Text>Prêt</Text>
      </Stepper.Panel>
      {children}
      <Stepper.Previous />
      <Stepper.Next />
    </Stepper.Root>
  );
}

function step(name: RegExp): HTMLElement {
  return screen.getByRole('tab', { name });
}

function disabled(node: HTMLElement): boolean {
  return node.getAttribute('aria-disabled') === 'true';
}

describe('Stepper', () => {
  it('is a named tablist whose current step says so', () => {
    render(<Flow />);

    expect(screen.getByRole('tablist', { name: 'Configuration' })).toBeTruthy();
    expect(step(/Compte/).getAttribute('aria-selected')).toBe('true');
    expect(step(/Compte/).getAttribute('aria-current')).toBe('step');
    expect(step(/Bibliothèque/).getAttribute('aria-current')).toBeNull();
  });

  it('names each step by its position, and says so once it is done', () => {
    render(<Flow />);

    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(screen.getByRole('tab', { name: 'Étape 1 sur 3 : Compte, terminée' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Étape 2 sur 3 : Bibliothèque' })).toBeTruthy();
  });

  it('opens at the first step and draws only its panel', () => {
    render(<Flow />);

    expect(screen.getByText('Adresse')).toBeTruthy();
    expect(screen.queryByText('Dossiers')).toBeNull();
    expect(screen.queryByText('Prêt')).toBeNull();
  });

  it('runs itself from a default step and reports why it moved', () => {
    const onValueChange = vi.fn();
    render(<Flow defaultValue="library" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(onValueChange).toHaveBeenCalledWith('done', { reason: 'next' });
    expect(screen.getByText('Prêt')).toBeTruthy();
  });

  it('leaves the step where it is when the caller owns the value', () => {
    const onValueChange = vi.fn();
    render(<Flow value="account" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(onValueChange).toHaveBeenCalledWith('library', { reason: 'next' });
    expect(screen.getByText('Adresse')).toBeTruthy();
  });

  it('dims the step back on the first step and the step forward on the last', () => {
    render(<Flow />);

    expect(disabled(screen.getByLabelText('Précédent'))).toBe(true);
    expect(disabled(screen.getByLabelText('Suivant'))).toBe(false);

    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(disabled(screen.getByLabelText('Suivant'))).toBe(true);
    expect(disabled(screen.getByLabelText('Précédent'))).toBe(false);
  });

  it('goes back to a step the flow has already been past', () => {
    render(<Flow />);

    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.click(step(/Compte/));

    expect(screen.getByText('Adresse')).toBeTruthy();
    expect(disabled(step(/Bibliothèque/))).toBe(false);
  });

  it('refuses a step the flow has not reached yet', () => {
    render(<Flow />);

    fireEvent.click(step(/Fin/));

    expect(disabled(step(/Fin/))).toBe(true);
    expect(screen.getByText('Adresse')).toBeTruthy();
  });

  it('takes the caller word for which steps are done', () => {
    render(<Flow complete={['done']} />);

    expect(disabled(step(/Fin/))).toBe(false);
    expect(disabled(step(/Bibliothèque/))).toBe(true);
  });

  it('steps over a step nothing may enter', () => {
    const onValueChange = vi.fn();
    render(<Flow value="skip" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByLabelText('Suivant'));

    expect(onValueChange).toHaveBeenCalledWith('done', { reason: 'next' });
  });

  it('walks the reachable steps with the arrow keys, and stops at the end', () => {
    render(<Flow defaultValue="library" />);

    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Configuration' }), {
      key: 'ArrowRight',
    });

    expect(screen.getByText('Dossiers')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Configuration' }), { key: 'ArrowLeft' });

    expect(screen.getByText('Adresse')).toBeTruthy();
  });

  it('refuses to render a part outside its Root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Stepper.Item value="account" />)).toThrow(
      '<Stepper.Item> must be used inside <Stepper.Root>',
    );

    vi.restoreAllMocks();
  });
});

let built = 0;

function Counted() {
  const [seen] = useState(() => {
    built += 1;
    return built;
  });
  return <Text>{`built ${seen}`}</Text>;
}

describe('a panel that has to survive the trip', () => {
  afterEach(() => {
    built = 0;
  });

  it('builds its children again every time by default', () => {
    render(
      <Flow>
        <Stepper.Panel value="account">
          <Counted />
        </Stepper.Panel>
      </Flow>,
    );

    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.click(screen.getByLabelText('Précédent'));

    expect(screen.getByText('built 2')).toBeTruthy();
  });

  it('takes a kept panel off the page while another step is showing', () => {
    render(
      <Flow>
        <Stepper.Panel value="account" keepMounted>
          <Counted />
        </Stepper.Panel>
      </Flow>,
    );

    fireEvent.click(screen.getByLabelText('Suivant'));

    const kept = screen.getByText('built 1').closest('[role="tabpanel"]');
    expect(kept?.getAttribute('style')).toBe('display: none !important;');
  });

  it('keeps what was typed in it when it asks to stay mounted', () => {
    render(
      <Flow>
        <Stepper.Panel value="account" keepMounted>
          <Counted />
        </Stepper.Panel>
      </Flow>,
    );

    fireEvent.click(screen.getByLabelText('Suivant'));
    fireEvent.click(screen.getByLabelText('Précédent'));

    expect(screen.getByText('built 1')).toBeTruthy();
  });
});

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

describe('useSteps', () => {
  const steps = ['account', 'library', 'done'];

  it('opens on the first step with nowhere to go back to', () => {
    const { result } = renderHook(() => useSteps(steps));

    expect(result.current).toMatchObject({ value: 'account', index: 0, count: 3, first: true });
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
  });

  it('opens every step it has been past, and none of the ones ahead', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.next());

    expect(result.current.complete('account')).toBe(true);
    expect(result.current.reachable('account')).toBe(true);
    expect(result.current.reachable('done')).toBe(false);
  });

  it('goes to a step ahead when its owner says so, rather than the indicator', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.goTo('done'));

    expect(result.current.value).toBe('done');
    expect(result.current.reachable('library')).toBe(true);
  });

  it('goes back to the first step and forgets how far it went', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.goTo('done'));
    act(() => result.current.reset());

    expect(result.current.value).toBe('account');
    expect(result.current.reachable('library')).toBe(false);
  });

  it('keeps one identity for every callback a caller may depend on', () => {
    const { result, rerender } = renderHook(() => useSteps(steps));
    const first = result.current;

    act(() => result.current.next());
    rerender();

    expect(result.current.next).toBe(first.next);
    expect(result.current.previous).toBe(first.previous);
    expect(result.current.goTo).toBe(first.goTo);
    expect(result.current.reset).toBe(first.reset);
  });
});
