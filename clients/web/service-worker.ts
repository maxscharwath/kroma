import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

/**
 * Emits the service worker.
 *
 * It is not part of the app bundle — the browser fetches `/sw.js` itself,
 * outside any module graph — so Vite never sees it as an entry. It used to be
 * hand-written straight into `public/`, which its own header defended as "no
 * build step to keep in sync". That held right up until the same arrangement on
 * the Tizen side turned out to be the one file no compiler checked; turning the
 * typechecker on THAT found four holes in a file of the same size.
 *
 * So: authored in `src/sw.ts` against `src/sw-globals.d.ts` and emitted here,
 * into `public/` — which Vite serves in dev and copies to `dist/client` on
 * build, so both paths get it without a separate command to forget. The output
 * is generated and git-ignored; edit the source, never the artefact.
 */
export function serviceWorkerPlugin(): Plugin {
  const entry = fileURLToPath(new URL('./src/sw.ts', import.meta.url));
  const out = fileURLToPath(new URL('./public/sw.js', import.meta.url));

  const emit = () =>
    build({
      entryPoints: [entry],
      outfile: out,
      bundle: true,
      format: 'iife',
      // A service worker only ever runs in a browser new enough to have one, so
      // the floor is about what those engines parse rather than about old TVs.
      target: ['chrome90', 'firefox90', 'safari15'],
      // The browser parses the whole worker on every push wake-up, before it can
      // show anything — so this is on the latency of the notification itself.
      minify: true,
      // No sourcemap: nothing else in this build ships one, and it would be the
      // only file in dist/client handing out its own source.
      legalComments: 'none',
    });

  return {
    name: 'kroma:service-worker',
    // Runs for `vite build` and at dev-server start alike.
    async buildStart() {
      await emit();
    },
    configureServer(server) {
      // Without this a worker edit needs a dev-server restart to reach the
      // browser, which is exactly the silent staleness the build step exists to
      // stop. Watched explicitly because nothing imports sw.ts.
      server.watcher.add(entry);
      server.watcher.on('change', (file) => {
        if (file === entry) emit().catch((err) => server.config.logger.error(String(err)));
      });
    },
  };
}
