// The quick-action bar a poster and a discover/trending card both wear: a row of
// buttons over the foot of the 2:3 art, revealed with the tile on hover or focus
// (always up on a touch screen). It is a bare container — it supplies the
// placement, the reveal and a press-shield, then the card composes the kit's own
// <IconButton>s inside it. No bespoke action API: the buttons are primitives,
// composed. The shield keeps a button press from also firing the tile's click.

import type { ReactNode } from 'react';

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

export function PosterActionBar({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="poster-actions" onClickCapture={stop} onPointerDownCapture={stop}>
      {children}
    </div>
  );
}
