import type { Activity } from '@luma/core';

/** Live scan/enrichment status pill, shown only while work is in progress. */
export function ActivityPill({ activity }: { activity: Activity | null }) {
  if (!activity) return null;
  let label: string | null = null;
  if (activity.scanning || activity.phase === 'scanning') label = 'Analyse de la bibliothèque…';
  else if (activity.phase === 'enriching' && activity.enrichTotal > 0)
    label = `Affiches ${activity.enrichDone}/${activity.enrichTotal}`;
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-[rgba(10,10,12,0.5)] px-[18px] py-2 font-sans text-[15px] font-semibold text-muted tabular-nums backdrop-blur-[10px]">
      <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_6px_22px_rgba(242,180,66,0.4)] [animation:luma-breathe_1.4s_var(--ease-out)_infinite]" />
      {label}
    </span>
  );
}
