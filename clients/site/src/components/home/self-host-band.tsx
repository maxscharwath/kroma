import {
  IconCloudOff,
  IconLicense,
  IconLock,
  IconWorldOff,
  type TablerIcon,
} from '@tabler/icons-react';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { BandHeading } from '#site/components/home/heading';
import { type SelfHostPointId, useHome } from '#site/lib/messages/home';
import { site } from '#site/lib/site';

const POINTS: readonly { id: SelfHostPointId; Icon: TablerIcon }[] = [
  { id: 'free', Icon: IconLicense },
  { id: 'private', Icon: IconLock },
  { id: 'noCentral', Icon: IconWorldOff },
  { id: 'offline', Icon: IconCloudOff },
];

// The ownership argument, given the weight of a full-width panel. The four points
// are the promise in plain terms; the terminal shows there is nothing more to it
// than one command. Kept on-palette: the "window controls" are neutral, not the
// decorative traffic lights that would drag a second colour in.
export function SelfHostBand() {
  const t = useHome().selfHost;

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="surface-hairline relative overflow-hidden rounded-3xl border border-border-strong bg-surface-1 p-8 sm:p-12">
          <div className="glow-amber pointer-events-none absolute inset-x-0 -top-24 h-56" />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <BandHeading eyebrow={t.eyebrow} heading={t.heading} />
              <p className="mt-4 text-pretty leading-relaxed text-muted">{t.lead}</p>

              <dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {POINTS.map(({ id, Icon }) => (
                  <div key={id} className="flex items-start gap-3">
                    <Icon
                      size={20}
                      stroke={1.75}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div>
                      <dt className="font-display text-sm font-bold text-text">
                        {t.points[id].title}
                      </dt>
                      <dd className="mt-0.5 text-sm text-muted">{t.points[id].sub}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-9">
                <Button href={site.repo} variant="outline">
                  {t.github}
                </Button>
              </div>
            </div>

            {/* One command, and it is running. A real self-host line, not a mockup. */}
            <div className="overflow-hidden rounded-2xl border border-border bg-bg/80 shadow-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="ml-2 font-mono text-[0.7rem] text-dim">{t.terminal}</span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.82rem] leading-relaxed text-muted">
                <code>
                  <span className="text-accent">$</span> docker run -d -p 4040:4040 \{'\n'}
                  {'    '}-v /volume1/video:/media \{'\n'}
                  {'    '}-v kroma-data:/data \{'\n'}
                  {'    '}ghcr.io/maxscharwath/kroma
                </code>
              </pre>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
