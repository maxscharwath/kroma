import { confirm, log, note } from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watch } from '../discovery/scan';
import { diagnoseEmptyScan } from '../hints';
import { askForLocalNetwork, openPrivacySettings } from '../local-network';
import type { Television } from '../television';
import { discover } from './discover';
import { liveMultiselect } from './live-multiselect';
import { within } from './terminal.fixture';

vi.mock('@clack/prompts', async (real) => ({
  ...(await real<typeof import('@clack/prompts')>()),
  note: vi.fn(),
  confirm: vi.fn(),
  log: { info: vi.fn() },
}));
vi.mock('../discovery/scan', () => ({ watch: vi.fn() }));
vi.mock('../hints', () => ({ diagnoseEmptyScan: vi.fn() }));
vi.mock('../local-network', () => ({
  askForLocalNetwork: vi.fn(),
  openPrivacySettings: vi.fn(),
}));
vi.mock('./live-multiselect', () => ({ liveMultiselect: vi.fn() }));

const salon: Television = {
  host: '192.168.1.10',
  platform: 'tizen',
  vendor: 'Samsung',
  name: 'Salon',
  model: 'QE55Q60A',
  developerMode: 'on',
  sideloadable: true,
  note: '',
  runtime: {
    name: 'Tizen',
    version: '8.0',
    engine: { name: 'Chromium', version: '108' },
    learned: 'reported',
  },
};

const cuisine: Television = {
  ...salon,
  host: '192.168.1.11',
  name: 'Cuisine',
  developerMode: 'off',
  runtime: null,
};

const chromecast: Television = {
  ...cuisine,
  host: '192.168.1.12',
  platform: 'androidtv',
  vendor: 'Google',
  name: 'Chromecast',
  developerMode: 'unknown',
  sideloadable: false,
};

function fakePicker() {
  let reply: (ticked: string[] | null) => void = () => undefined;
  const answer = new Promise<string[] | null>((resolve) => {
    reply = resolve;
  });
  return { upsert: vi.fn(), status: vi.fn(), notice: vi.fn(), answer, reply };
}

let picker = fakePicker();

const lastStatus = () => picker.status.mock.lastCall?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  picker = fakePicker();
  vi.mocked(liveMultiselect<string>).mockReturnValue(picker);
  vi.mocked(diagnoseEmptyScan).mockResolvedValue({ blocked: false, hints: ['nothing was on'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('discover', () => {
  it('lists a set the scan found, ticked and ready', async () => {
    vi.mocked(watch).mockImplementation(async ({ onFound }) => {
      onFound?.(salon);
      picker.reply([salon.host]);
      return [salon];
    });

    const chosen = await within(discover());

    expect(picker.upsert).toHaveBeenCalledWith({
      value: '192.168.1.10',
      label: 'Salon  192.168.1.10',
      hint: 'Samsung · Tizen 8.0, Chromium 108 · ready',
      disabled: false,
      ticked: true,
    });
    expect(chosen).toEqual([salon]);
  });

  it('says what a set still needs before it can take the app', async () => {
    vi.mocked(watch).mockImplementation(async ({ onFound }) => {
      onFound?.(cuisine);
      picker.reply([]);
      return [cuisine];
    });

    await within(discover());

    expect(picker.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ hint: 'Samsung · developer mode off', ticked: false }),
    );
  });

  it('greys out a set no app can be sideloaded onto', async () => {
    vi.mocked(watch).mockImplementation(async ({ onFound }) => {
      onFound?.(chromecast);
      picker.reply([]);
      return [chromecast];
    });

    await within(discover());

    expect(picker.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ hint: 'Google · takes no app', disabled: true }),
    );
  });

  it('stops the scan as soon as the picker answers', async () => {
    let scanning: AbortSignal | undefined;
    vi.mocked(watch).mockImplementation(async ({ signal }) => {
      scanning = signal;
      picker.reply([]);
      return [];
    });

    await within(discover(['192.168.1.10']));

    expect(vi.mocked(watch).mock.calls[0]?.[0]).toMatchObject({ hosts: ['192.168.1.10'] });
    expect(scanning?.aborted).toBe(true);
  });

  it('gives up looking once the round cap is reached', async () => {
    let rounds = 0;
    vi.mocked(watch).mockImplementation(async ({ onRound, signal }) => {
      while (!signal?.aborted && rounds < 100) onRound?.(++rounds);
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(rounds).toBe(41);
    expect(lastStatus()).toBe('stopped looking · no television yet');
  });

  it('says why the network is quiet after two rounds that found nothing', async () => {
    vi.mocked(watch).mockImplementation(async ({ onRound }) => {
      onRound?.(1);
      onRound?.(2);
      onRound?.(3);
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(picker.notice).toHaveBeenCalledExactlyOnceWith(
      'a set that has not answered by now is off, or has no developer mode on',
    );
    expect(lastStatus()).toBe('nothing new · no television yet');
  });

  it('counts a round that found something as a reason to keep going', async () => {
    vi.mocked(watch).mockImplementation(async ({ onRound, onFound }) => {
      onRound?.(1);
      onRound?.(2);
      onFound?.(salon);
      onRound?.(3);
      picker.reply([]);
      return [salon];
    });

    await within(discover());

    expect(picker.notice).not.toHaveBeenCalled();
    expect(lastStatus()).toBe('scanning again · 1 television');
  });

  it('counts every television it has found so far', async () => {
    vi.mocked(watch).mockImplementation(async ({ onRound, onFound }) => {
      onRound?.(1);
      onFound?.(salon);
      onFound?.(cuisine);
      picker.reply([]);
      return [salon, cuisine];
    });

    await within(discover());

    expect(lastStatus()).toBe('scanning · 2 televisions');
  });

  it('collapses a burst of progress into a handful of redraws', async () => {
    vi.mocked(watch).mockImplementation(async ({ onRound, onProgress }) => {
      onRound?.(1);
      for (let done = 1; done <= 256; done += 1) onProgress?.(done, 256);
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(picker.status.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('draws progress again once the redraw window has passed', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    vi.mocked(watch).mockImplementation(async ({ onRound, onProgress }) => {
      onRound?.(1);
      for (let done = 1; done <= 32; done += 1) onProgress?.(done, 256);
      vi.advanceTimersByTime(200);
      onProgress?.(200, 256);
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(lastStatus()).toBe('scanning 78% · no television yet');
  });

  it('reports no progress at all past the first round', async () => {
    vi.mocked(watch).mockImplementation(async ({ onRound, onProgress }) => {
      onRound?.(1);
      onRound?.(2);
      onProgress?.(128, 256);
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(lastStatus()).toBe('nothing new · no television yet');
  });

  it('explains a scan that came back empty, and drops the hosts it never saw', async () => {
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply(['192.168.1.99']);
      return [];
    });

    const chosen = await within(discover());

    expect(chosen).toEqual([]);
    expect(note).toHaveBeenCalledWith('nothing was on', 'why nothing answered');
  });

  it('opens the Local Network pane when macOS is the one refusing', async () => {
    vi.mocked(diagnoseEmptyScan).mockResolvedValue({ blocked: true, hints: ['macOS is refusing'] });
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(openPrivacySettings).mockResolvedValue(true);
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(log.info).toHaveBeenCalledWith('System Settings is open');
  });

  it('says so when the Local Network pane would not open', async () => {
    vi.mocked(diagnoseEmptyScan).mockResolvedValue({ blocked: true, hints: ['macOS is refusing'] });
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(openPrivacySettings).mockResolvedValue(false);
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(log.info).toHaveBeenCalledWith('could not open Settings');
  });

  it('opens nothing when the offer to open System Settings is turned down', async () => {
    vi.mocked(diagnoseEmptyScan).mockResolvedValue({ blocked: true, hints: ['macOS is refusing'] });
    vi.mocked(confirm).mockResolvedValue(false);
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(openPrivacySettings).not.toHaveBeenCalled();
  });

  it('answers null when the picker was quit, and explains nothing', async () => {
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply(null);
      return [];
    });

    const chosen = await within(discover());

    expect(chosen).toBeNull();
    expect(note).not.toHaveBeenCalled();
  });

  it('counts every set it has found so far', async () => {
    vi.mocked(watch).mockImplementation(async ({ onFound }) => {
      onFound?.(salon);
      onFound?.(cuisine);
      picker.reply([]);
      return [salon, cuisine];
    });

    await within(discover());

    expect(lastStatus()).toBe('scanning · 2 televisions');
  });

  it('asks macOS for the local network before it opens the picker', async () => {
    vi.mocked(watch).mockImplementation(async () => {
      picker.reply([]);
      return [];
    });

    await within(discover());

    expect(askForLocalNetwork).toHaveBeenCalled();
  });
});
