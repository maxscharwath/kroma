// How fast the engine may go and how much of it may run at once.
//
// These are engine-wide settings, edited from the queue rather than a settings
// tab: an operator caps a download while watching it run. A rate takes hold on
// the running session immediately; raising the parallelism cap starts whatever
// it was holding back on the monitor's next tick.
//
// "Unlimited" is a CHOICE here, not a magic zero an operator has to be told
// about. The wire still says 0, because that is what the engine means by no
// ceiling; the form never asks anyone to know that.

import { useAsyncAction, useT } from '@kroma/module-sdk';
import { Box, Callout, Dialog, Field, InputGroup, Row, Spinner } from '@kroma/ui/kit';
import { useEffect, useState } from 'react';
import { createCallable } from 'react-call';
import { useTorrentsApi } from './api';
import type { LimitsView } from './schemas';

const UNLIMITED = 0;
// What switching a limit on starts from when none was set: a number an operator
// recognises as a starting point rather than an empty box.
const DEFAULT_RATE_KBPS = 5120;
const DEFAULT_PARALLEL = 3;

/** Opened with `LimitsModal.call()`; resolves `true` once saved. */
export const LimitsModal = createCallable<void, boolean>(({ call }) => {
  const t = useT();
  const torrents = useTorrentsApi();
  const { busy, error, run } = useAsyncAction();
  const [limits, setLimits] = useState<LimitsView | null>(null);

  // A ceiling nobody could read shows as unlimited, which is what an
  // unreachable setting means for the engine anyway.
  useEffect(() => {
    torrents
      .limits()
      .then(setLimits)
      .catch(() => setLimits({ downKbps: UNLIMITED, upKbps: UNLIMITED, maxActive: UNLIMITED }));
  }, [torrents]);

  const set = (patch: Partial<LimitsView>) =>
    setLimits((current) => (current ? { ...current, ...patch } : current));

  const save = () => {
    if (!limits) return;
    run(
      async () => {
        await torrents.saveLimits(limits);
        call.end(true);
      },
      () => t('downloads.limitsFailed'),
    );
  };

  return (
    <Dialog.Root open title={t('downloads.limitsTitle')} onClose={() => call.end(false)} width="sm">
      {limits ? (
        <>
          <Box gap={18}>
            <Ceiling
              label={t('downloads.limitDown')}
              unit={t('downloads.unitKbps')}
              value={limits.downKbps}
              whenOn={DEFAULT_RATE_KBPS}
              onValueChange={(downKbps) => set({ downKbps })}
            />
            <Ceiling
              label={t('downloads.limitUp')}
              unit={t('downloads.unitKbps')}
              value={limits.upKbps}
              whenOn={DEFAULT_RATE_KBPS}
              onValueChange={(upKbps) => set({ upKbps })}
            />
            <Ceiling
              label={t('downloads.limitParallel')}
              unit={t('downloads.unitAtOnce')}
              value={limits.maxActive}
              whenOn={DEFAULT_PARALLEL}
              onValueChange={(maxActive) => set({ maxActive })}
            />
          </Box>
          {error ? (
            <Callout.Root size="sm" tone="danger" icon="alert-triangle">
              <Callout.Title>{error}</Callout.Title>
            </Callout.Root>
          ) : null}
          <Dialog.Actions
            onCancel={() => call.end(false)}
            cancelLabel={t('common.cancel')}
            onConfirm={save}
            confirmLabel={t('common.save')}
            busy={busy}
          />
        </>
      ) : (
        <Row center py={24}>
          <Spinner />
        </Row>
      )}
    </Dialog.Root>
  );
});

// Digits only: the entry is a ceiling, and a stray letter would read as 0,
// silently turning the limit off.
function digitsOf(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? UNLIMITED : Number(digits);
}

interface CeilingProps {
  label: string;
  /** Welded onto the entry, so the number never carries its own unit. */
  unit: string;
  value: number;
  /** What switching the limit on starts from when nothing was set. */
  whenOn: number;
  onValueChange: (next: number) => void;
}

// One ceiling, as ONE control: the number on the left, the unit welded to it,
// and the switch on the right that says whether there is a ceiling at all.
// Turning the limit off greys the entry rather than hiding it, so the row never
// changes height and the number an operator typed is still there when they turn
// it back on.
function Ceiling({ label, unit, value, whenOn, onValueChange }: Readonly<CeilingProps>) {
  const t = useT();
  const limited = value > UNLIMITED;
  // Remembered, so switching to unlimited and back does not lose the number.
  const [previous, setPrevious] = useState(limited ? value : whenOn);

  const toggle = () => {
    if (limited) {
      setPrevious(value);
      onValueChange(UNLIMITED);
      return;
    }
    onValueChange(previous > UNLIMITED ? previous : whenOn);
  };

  return (
    <Field.Root label={label} size="sm">
      <InputGroup.Root label={label} size="sm">
        <InputGroup.Input
          value={limited ? String(value) : ''}
          onValueChange={(next) => onValueChange(digitsOf(next))}
          placeholder={t('downloads.unlimited')}
          readOnly={!limited}
          selectOnFocus
        />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Text>{limited ? unit : ''}</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.IconButton
          icon="infinity"
          label={t('downloads.unlimitedToggle', { what: label })}
          active={!limited}
          pressed={!limited}
          onPress={toggle}
        />
      </InputGroup.Root>
    </Field.Root>
  );
}
