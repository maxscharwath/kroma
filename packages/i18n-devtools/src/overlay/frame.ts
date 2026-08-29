/** Run `work` at most once a frame, however often it is asked for. Returns the
 *  ask, with `stop` to drop one that has not run yet. */
export function perFrame(work: () => void): { fire: () => void; stop: () => void } {
  let frame = 0;
  return {
    fire: () => {
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          work();
        });
    },
    stop: () => {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
