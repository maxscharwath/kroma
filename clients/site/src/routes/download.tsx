import { createFileRoute } from '@tanstack/react-router';
import { AppPlatforms } from '#site/components/download/app-platforms';
import { Closing } from '#site/components/download/closing';
import { DownloadHero } from '#site/components/download/hero';
import { InstallStep } from '#site/components/download/install-step';
import { ServerOptions } from '#site/components/download/server-options';
import { download, useDownload } from '#site/lib/messages/download';
import { seo } from '#site/lib/seo';

export const Route = createFileRoute('/download')({
  // `head` runs outside React, so it reads the catalog directly; the hook is
  // unavailable here and this route is the English one.
  head: () => ({ ...seo({ lang: 'en', title: download.en.head.title, path: '/download' }) }),
  component: Download,
});

/** The install page: the model, then the server, then every screen, then why the
 *  one-time setup exists. Shared with /fr/download, which renders this component
 *  under the French locale. */
export function Download() {
  const t = useDownload();
  return (
    <>
      <DownloadHero />

      <InstallStep id="serveur" step="01" title={t.server.step.title} intro={t.server.step.intro}>
        <ServerOptions />
      </InstallStep>

      <InstallStep id="apps" step="02" title={t.apps.step.title} intro={t.apps.step.intro}>
        <AppPlatforms />
      </InstallStep>

      <Closing />
    </>
  );
}
