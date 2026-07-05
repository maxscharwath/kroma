// The request status chip, one component for every surface: poster-card
// overlay (`card`), table/list rows (`row`) and the discover-detail hero
// (`hero`, with a live progress bar while downloading).

import type { RequestStatus } from '@luma/core';
import { useT } from '@luma/ui';
import { requestStatusMeta } from '#web/features/requests/status';

export function RequestStatusChip({
  status,
  size = 'row',
  progress,
}: Readonly<{
  status: RequestStatus;
  size?: 'card' | 'row' | 'hero';
  /** 0..1 while downloading (page-scoped live events); shown on `hero`/`row`. */
  progress?: number | null;
}>) {
  const t = useT();
  const m = requestStatusMeta(status);
  const pct =
    status === 'downloading' && progress != null ? `${Math.round(progress * 100)}%` : null;

  if (size === 'card') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[.06em] backdrop-blur-[6px]"
        style={{ color: m.color, background: m.bg }}
      >
        <span
          className={`h-1 w-1 rounded-full ${m.pulse ? 'animate-pulse' : ''}`}
          style={{ background: m.dot }}
        />
        {t(m.labelKey)}
        {pct ? <span className="tabular-nums">{pct}</span> : null}
      </span>
    );
  }

  if (size === 'hero') {
    return (
      <span className="inline-flex flex-col gap-2">
        <span
          className="inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-[13.5px] font-bold"
          style={{ color: m.color, background: m.bg }}
        >
          <span
            className={`h-2 w-2 rounded-full ${m.pulse ? 'animate-pulse' : ''}`}
            style={{ background: m.dot }}
          />
          {t(m.labelKey)}
          {pct ? <span className="tabular-nums">{pct}</span> : null}
        </span>
        {status === 'downloading' && progress != null ? (
          <span className="h-1 w-44 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[11.5px] font-bold"
      style={{ color: m.color, background: m.bg }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${m.pulse ? 'animate-pulse' : ''}`}
        style={{ background: m.dot }}
      />
      {t(m.labelKey)}
      {pct ? <span className="tabular-nums">{pct}</span> : null}
    </span>
  );
}
