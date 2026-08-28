import { describe, expect, it, vi } from 'vitest';
import {
  attachHlsRecovery,
  type HlsClassLike,
  STALL_POLL_MS,
  type StallSample,
  type StallStep,
  type StallWatch,
  stallWatch,
} from './playback-stall';

function playing(over: Partial<StallSample> = {}): StallSample {
  return {
    currentTime: 100,
    bufferedEnd: 160,
    paused: false,
    ended: false,
    seeking: false,
    readyState: 4,
    ...over,
  };
}

function hold(watch: StallWatch, from: number, polls: number, at = 100): StallStep[] {
  const steps: StallStep[] = [];
  for (let i = 1; i <= polls; i += 1) {
    const step = watch.observe(playing({ currentTime: at }), from + i * STALL_POLL_MS);
    if (step) steps.push(step);
  }
  return steps;
}

const HLS_CLASS: HlsClassLike = {
  Events: { ERROR: 'hlsError' },
  ErrorTypes: { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' },
};

function fakeHls() {
  let listener: (event: string, data: { type: string; fatal: boolean }) => void = () => undefined;
  const hls = {
    on: (_event: string, fn: typeof listener) => {
      listener = fn;
    },
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
  };

  return {
    hls,
    fire: (type: string, fatal = true) => listener('hlsError', { type, fatal }),
  };
}

describe('stallWatch', () => {
  it('asks for nothing while the picture is moving', () => {
    const watch = stallWatch();

    const steps = [0, 1, 2, 3, 4].map((i) =>
      watch.observe(playing({ currentTime: 100 + i }), i * STALL_POLL_MS),
    );

    expect(steps).toEqual([null, null, null, null, null]);
    expect(watch.stalled()).toBe(false);
  });

  it('nudges a playhead that has stopped with buffer still ahead of it', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);

    const steps = hold(watch, 0, 4);

    expect(steps).toEqual(['nudge']);
    expect(watch.stalled()).toBe(true);
  });

  it('climbs the ladder while the nudges do not take', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);

    const steps = hold(watch, 0, 20);

    expect(steps).toEqual(['nudge', 'nudge', 'recover', 'restart']);
  });

  it('stops climbing once the ladder runs out, and stays stalled', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);
    hold(watch, 0, 20);

    const steps = hold(watch, 20 * STALL_POLL_MS, 20);

    expect(steps).toEqual([]);
    expect(watch.stalled()).toBe(true);
  });

  it('does not read the jump a nudge itself makes as a recovery', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);
    expect(hold(watch, 0, 4)).toEqual(['nudge']);

    watch.observe(playing({ currentTime: 100.1 }), 2500);
    const steps = hold(watch, 2500, 5, 100.1);

    expect(steps).toEqual(['nudge']);
  });

  it('clears the ladder once the playhead keeps moving', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);
    hold(watch, 0, 4);

    watch.observe(playing({ currentTime: 100.1 }), 2500);
    watch.observe(playing({ currentTime: 100.6 }), 3000);
    const steps = hold(watch, 3000, 5, 100.6);

    expect(steps).toEqual(['nudge']);
    expect(watch.stalled()).toBe(true);
  });

  it('leaves a playhead that has genuinely run out to the engine', () => {
    const watch = stallWatch();

    const steps = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
      watch.observe(playing({ bufferedEnd: 100.2 }), i * STALL_POLL_MS),
    );

    expect(steps.every((s) => s === null)).toBe(true);
    expect(watch.stalled()).toBe(false);
  });

  it('is not a stall when nothing is meant to be playing', () => {
    for (const over of [
      { paused: true },
      { ended: true },
      { seeking: true },
      { readyState: 2 },
    ] satisfies Partial<StallSample>[]) {
      const watch = stallWatch();
      watch.observe(playing(), 0);
      hold(watch, 0, 4);

      const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((i) =>
        watch.observe(playing(over), 2000 + i * STALL_POLL_MS),
      );

      expect(steps.every((s) => s === null)).toBe(true);
      expect(watch.stalled()).toBe(false);
    }
  });

  it('starts the ladder again after a reset', () => {
    const watch = stallWatch();
    watch.observe(playing(), 0);
    hold(watch, 0, 20);

    watch.reset();
    watch.observe(playing(), 0);
    const steps = hold(watch, 0, 4);

    expect(steps).toEqual(['nudge']);
  });
});

describe('attachHlsRecovery', () => {
  it('reloads on a fatal network error and recovers a fatal media one', () => {
    const giveUp = vi.fn();
    const { hls, fire } = fakeHls();
    attachHlsRecovery(HLS_CLASS, hls, giveUp);

    fire('networkError');
    fire('mediaError');

    expect(hls.startLoad).toHaveBeenCalledTimes(1);
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('leaves a non-fatal error to hls.js', () => {
    const giveUp = vi.fn();
    const { hls, fire } = fakeHls();
    attachHlsRecovery(HLS_CLASS, hls, giveUp);

    fire('mediaError', false);

    expect(hls.recoverMediaError).not.toHaveBeenCalled();
    expect(giveUp).not.toHaveBeenCalled();
  });

  it('gives up once the same failure has survived its recoveries', () => {
    const giveUp = vi.fn();
    const { hls, fire } = fakeHls();
    attachHlsRecovery(HLS_CLASS, hls, giveUp);

    fire('mediaError');
    fire('mediaError');
    fire('mediaError');

    expect(hls.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(giveUp).toHaveBeenCalledTimes(1);
  });

  it('forgives a failure the film has since played through', () => {
    const giveUp = vi.fn();
    const { hls, fire } = fakeHls();
    attachHlsRecovery(HLS_CLASS, hls, giveUp);
    const clock = vi.spyOn(Date, 'now');

    clock.mockReturnValue(0);
    fire('mediaError');
    fire('mediaError');
    clock.mockReturnValue(120_000);
    fire('mediaError');

    expect(hls.recoverMediaError).toHaveBeenCalledTimes(3);
    expect(giveUp).not.toHaveBeenCalled();
    clock.mockRestore();
  });
});
