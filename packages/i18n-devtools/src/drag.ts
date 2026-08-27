const THRESHOLD_PX = 4;
const MARGIN_PX = 8;

export function place(host: HTMLElement, x: number, y: number): void {
  const width = host.offsetWidth || 120;
  const height = host.offsetHeight || 40;
  host.style.right = 'auto';
  host.style.bottom = 'auto';
  host.style.left = `${Math.min(Math.max(x, MARGIN_PX), window.innerWidth - width - MARGIN_PX)}px`;
  host.style.top = `${Math.min(Math.max(y, MARGIN_PX), window.innerHeight - height - MARGIN_PX)}px`;
}

/** Drag `host` from anywhere inside it. A press that never passes the threshold
 *  stays a press, so the badge under the pointer still opens the panel; one that
 *  does swallows the click it would otherwise have become. */
export function draggable(host: HTMLElement, onDrop: (x: number, y: number) => void): () => void {
  let from: { pointerX: number; pointerY: number; left: number; top: number } | null = null;
  let dragged = false;

  const down = (event: PointerEvent) => {
    const box = host.getBoundingClientRect();
    from = { pointerX: event.clientX, pointerY: event.clientY, left: box.left, top: box.top };
    dragged = false;
  };

  const move = (event: PointerEvent) => {
    if (!from) return;
    const dx = event.clientX - from.pointerX;
    const dy = event.clientY - from.pointerY;
    if (!dragged && Math.hypot(dx, dy) < THRESHOLD_PX) return;
    dragged = true;
    place(host, from.left + dx, from.top + dy);
  };

  const up = () => {
    if (from && dragged) {
      const box = host.getBoundingClientRect();
      onDrop(box.left, box.top);
    }
    from = null;
  };

  const click = (event: MouseEvent) => {
    if (!dragged) return;
    dragged = false;
    event.stopPropagation();
    event.preventDefault();
  };

  host.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  host.addEventListener('click', click, true);
  return () => {
    host.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    host.removeEventListener('click', click, true);
  };
}
