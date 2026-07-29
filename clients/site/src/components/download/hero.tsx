import { IconArrowRight, IconDeviceTv, IconServer } from '@tabler/icons-react';
import { Container } from '#site/components/container';
import type { IconComponent } from '#site/components/download/icon';
import { useDownload } from '#site/lib/messages/download';

/** The page opener: the model in one line, then a two-node "server → clients" strip. */
export function DownloadHero() {
  const t = useDownload().hero;
  return (
    <section className="relative overflow-hidden">
      <div className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <Container>
        <div className="relative max-w-3xl py-20 sm:py-24">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {t.eyebrow}
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.03] text-text sm:text-5xl">
            {t.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted">{t.lede}</p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <ModelNode icon={IconServer} label={t.server.label} detail={t.server.detail} />
            <IconArrowRight
              size={22}
              stroke={1.75}
              className="mx-auto shrink-0 rotate-90 text-dim sm:rotate-0"
              aria-hidden
            />
            <ModelNode icon={IconDeviceTv} label={t.client.label} detail={t.client.detail} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function ModelNode({
  icon: Icon,
  label,
  detail,
}: {
  icon: IconComponent;
  label: string;
  detail: string;
}) {
  return (
    <div className="surface-hairline flex flex-1 items-start gap-3 rounded-xl border border-border bg-surface-1/50 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
        <Icon size={18} stroke={1.75} aria-hidden />
      </div>
      <div>
        <p className="font-display text-sm font-bold text-text">{label}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted">{detail}</p>
      </div>
    </div>
  );
}
