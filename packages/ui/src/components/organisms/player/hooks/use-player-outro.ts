import { useEffect, useEffectEvent, useRef } from 'react';

/**
 * What happens when a film reaches its end with nothing queued behind it (§10).
 * A next episode is the credits countdown's business (see usePlayerCredits);
 * this covers everything else, so the player never parks on a dead frame:
 * suggestions rise as the up-next sheet, and with none the player leaves.
 */
export function usePlayerOutro(opts: {
  endedNonce: number;
  hasNext: boolean;
  hasSuggestions: boolean;
  onSuggest: () => void;
  onLeave: () => void;
}): void {
  const { endedNonce, hasNext, hasSuggestions, onSuggest, onLeave } = opts;
  // The count as it stood on mount, so an engine that carries its nonce across a
  // title swap does not fire the outro again on the film that follows.
  const seen = useRef(endedNonce);
  const run = useEffectEvent(() => (hasSuggestions ? onSuggest() : onLeave()));

  useEffect(() => {
    if (endedNonce === seen.current || hasNext) return;
    seen.current = endedNonce;
    run();
  }, [endedNonce, hasNext]);
}
