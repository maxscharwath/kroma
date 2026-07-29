import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { Panel } from '#site/components/download/panel';
import { docs, useDownload } from '#site/lib/messages/download';
import { site } from '#site/lib/site';

/** The last word: why the one-time setup exists, and where to go next. */
export function Closing() {
  const t = useDownload().closing;
  return (
    <section className="border-t border-border/60 py-20">
      <Container>
        <Panel pad="lg">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold text-text">{t.title}</h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">{t.body}</p>
            <p className="mt-4 text-sm leading-relaxed text-dim">{t.note}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={docs.releases} size="lg">
              {t.releases}
            </Button>
            <Button href={docs.installGuide} variant="outline" size="lg">
              {t.guide}
            </Button>
            <Button href={site.tvUrl} variant="outline" size="lg">
              {t.tvDemo}
            </Button>
            <Button to="/support" variant="ghost" size="lg">
              {t.help}
            </Button>
          </div>
        </Panel>
      </Container>
    </section>
  );
}
