// The fast half of "connect a device": the TVs waiting on this network, one tap
// each. Everything it decides lives in `useNearbyTvs`; this brings the rows.
//
// A browser cannot listen to its own link, so the server is this shell's only
// source. The phone app passes a second one.
//
// Every row carries the check string that television is printing on its own
// screen. Usually nobody is asked to type it: it is there so a device that named
// itself after yours can be told from yours. A row the server could not PLACE is
// the exception, and asks for it (see <CheckPrompt>).
//
// The outcome of a click is shown on the row that was clicked, the way the phone
// shows it: a spinner, then a tick or the reason it failed. Either ending can
// pull the row out from under the reader (a granted beacon is spent, and a
// lapsed one leaves on the next server poll), so the clicked row is held here
// for a few seconds whichever way it went.
//
// It renders nothing at all when nothing is waiting and nothing was clicked: an
// empty box above the code field would only ask the reader to work out whether
// it is broken.

import type { DiscoveredTv, FinalRefusal, GrantRefusal, GrantResult } from '@kroma/core';
import { checkRetryable, HANDOFF_CHECK_LENGTH } from '@kroma/core';
import { useNearbyTvs } from '@kroma/core/react';
import { useT } from '@kroma/ui';
import {
  Badge,
  Button,
  Icon,
  ListRow,
  OtpField,
  REGEXP_ONLY_DIGITS_AND_CHARS,
  Spinner,
  Txt,
} from '@kroma/ui/kit';
import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '#web/shared/lib/auth';

// How long a finished row keeps saying how it finished. A confirmation that
// never leaves is worse than none.
const OUTCOME_MS = 4000;

type Outcome = 'done' | FinalRefusal;

interface Attempt {
  device: DiscoveredTv;
  outcome: Outcome | null;
}

export function NearbyTvs() {
  const t = useT();
  const { client } = useAuth();
  const { devices, connecting, connect } = useNearbyTvs({ client });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [asking, setAsking] = useState<DiscoveredTv | null>(null);

  useEffect(() => {
    if (!attempt?.outcome) return;
    const timer = setTimeout(() => setAttempt(null), OUTCOME_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  const grant = async (device: DiscoveredTv, check?: string): Promise<GrantResult> => {
    setAttempt({ device, outcome: null });
    const result = await connect(device, check);
    if (result === 'dropped') return result;
    if (result === 'granted') {
      setAttempt({ device, outcome: 'done' });
      setAsking(null);
      return result;
    }
    // A refusal the prompt can do something about is the prompt's to show, and
    // the row is still a row: that beacon is standing and the next code may be
    // the right one.
    if (checkRetryable(result)) {
      setAttempt(null);
      // A row this shell believed needed no code, and the server says otherwise:
      // ask for it rather than leave a click that did nothing.
      if (result === 'checkRequired') setAsking(device);
      return result;
    }
    setAttempt({ device, outcome: result });
    setAsking(null);
    return result;
  };

  const start = (device: DiscoveredTv) => {
    if (device.confirmRequired) {
      setAsking(device);
      return;
    }
    void grant(device);
  };

  // The clicked row goes first: it is the one the reader just acted on, and the
  // list beneath it can reorder as televisions come and go without moving it.
  const rows =
    attempt && !devices.some((d) => d.handle === attempt.device.handle)
      ? [attempt.device, ...devices]
      : devices;

  if (rows.length === 0 && !asking) return null;

  return (
    <section className="mb-8 text-left">
      <h2 className="mb-1 font-display text-[15px] font-bold">{t('handoff.nearbyTitle')}</h2>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">{t('handoff.nearbySub')}</p>

      {asking ? (
        <CheckPrompt device={asking} onGrant={grant} onCancel={() => setAsking(null)} />
      ) : (
        <ListRow.Group>
          {rows.map((device) => {
            const busy = connecting?.handle === device.handle;
            const outcome = attempt?.device.handle === device.handle ? attempt.outcome : null;
            return (
              <ListRow
                key={device.handle}
                size="sm"
                icon="device-tv"
                label={device.name}
                hint={rowHint(device, busy, outcome, t) || undefined}
                trailing={rowTrailing(device, busy, outcome)}
                onPress={outcome ? undefined : () => start(device)}
              />
            );
          })}
        </ListRow.Group>
      )}

      <Txt style={{ fontSize: 12, marginTop: 18, textAlign: 'center' }} color="textDim">
        {t('handoff.otherWays')}
      </Txt>
    </section>
  );
}

// The one television the server could not place, and the code it is printing.
// Replaces the list rather than sitting under it: the reader has picked, and
// what is left to do is read five characters off a screen across the room.
function CheckPrompt({
  device,
  onGrant,
  onCancel,
}: Readonly<{
  device: DiscoveredTv;
  onGrant: (device: DiscoveredTv, check: string) => Promise<GrantResult>;
  onCancel: () => void;
}>) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<GrantRefusal | null>(null);
  const asked = t('handoff.checkPrompt', { name: device.name });

  const submit = async (value: string) => {
    setBusy(true);
    setRefused(null);
    const result = await onGrant(device, value);
    setBusy(false);
    if (result === 'granted' || result === 'dropped') return;
    setRefused(result);
    setCode('');
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-2 px-4 py-6">
      <p className="text-center font-display text-[15px] font-bold">{asked}</p>
      <OtpField
        maxLength={HANDOFF_CHECK_LENGTH}
        value={code}
        // The alphabet has letters in it, and a browser on a desktop capitalizes
        // nothing by itself, so the case is ours to fix as it is typed.
        onChange={(next) => setCode(next.toUpperCase())}
        onComplete={(value) => void submit(value.toUpperCase())}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        physicalKeyboard
        autoFocus
        disabled={busy}
        invalid={refused !== null}
        label={asked}
      />
      <p
        className={`text-center text-[13px] ${refused ? 'font-medium text-danger' : 'text-muted'}`}
      >
        {refused ? t(`handoff.${refused}`) : t('handoff.checkHint')}
      </p>
      <Button variant="ghost" size="sm" label={t('common.cancel')} onPress={onCancel} />
    </div>
  );
}

function rowHint(
  device: DiscoveredTv,
  busy: boolean,
  outcome: Outcome | null,
  t: ReturnType<typeof useT>,
): string {
  if (busy) return t('handoff.connecting');
  if (outcome) return outcome === 'done' ? t('handoff.rowDone') : t(`handoff.${outcome}`);
  // A television that has no name of its own publishes its platform as one
  // (see `deviceName` in packages/tv), so showing the platform underneath it
  // would print the same word twice.
  return device.platform === device.name ? '' : device.platform;
}

function rowTrailing(device: DiscoveredTv, busy: boolean, outcome: Outcome | null): ReactNode {
  if (busy) return <Spinner size={18} thickness={2} />;
  if (outcome === 'done') return <Icon name="check" size={18} color="success" />;
  if (outcome) return <Icon name="alert-triangle" size={18} color="danger" />;
  return <Badge tone="neutral">{device.check}</Badge>;
}
