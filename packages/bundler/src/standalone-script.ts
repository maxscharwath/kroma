// Bundling for the scripts that live OUTSIDE the app's module graph.
//
// Every client has one or two: a service worker the browser fetches by URL, a
// Tizen background service the platform launches from a path in config.xml.
// Nothing imports them, so Vite never sees them, so for a long time they were
// hand-written straight into `public/` and copied verbatim — which made them the
// only files in the repo no compiler read. The Tizen preview service shipped
// `?.` to a Chromium 76 that treats it as a SyntaxError, and killed the Smart
// Hub carousel silently; turning the typechecker on the web service worker,
// a file of the same size, found four more holes.
//
// So they are TypeScript now, and this emits them. It lives in its own package
// because more than one client needs it: a relative hop into another client's
// directory would be an undeclared dependency, resolving that client's imports
// from wherever the path happened to land.

import { type BuildOptions, build } from 'esbuild';
import type { Plugin } from 'vite';

export interface StandaloneScriptOptions {
  /** The entry to bundle. Absolute, or relative to the Vite root. */
  entry: string;
  /** Where to write the bundle. Absolute, or relative to the Vite root. */
  outfile: string;
  /**
   * When to emit.
   *
   * `start` (the default) emits before the bundle, which is what you want for
   * anything under `public/`: Vite copies that directory into the output, and
   * the dev server serves it straight from disk.
   *
   * `end` emits after, for an output that writes somewhere the build itself
   * would otherwise wipe — the Tizen service lands in `dist/service/`, and a
   * second Vite build over the same `dist/` would take it with it.
   */
  emit?: 'start' | 'end';
  /**
   * esbuild overrides. The defaults produce one self-contained, minified IIFE;
   * the Tizen service wants CJS on a `neutral` platform, and something that
   * ships to an engine older than the browser floor wants its own `target`.
   */
  esbuild?: BuildOptions;
}

/**
 * Emit a script that nothing imports, as part of the normal build.
 *
 * The point is that there is no separate command to forget: `dev` and `build`
 * both produce it, and in dev an edit to the source rebuilds it rather than
 * needing a server restart. The output is a build artefact — git-ignore it and
 * edit the source.
 */
export function standaloneScript({
  entry,
  outfile,
  emit = 'start',
  esbuild = {},
}: StandaloneScriptOptions): Plugin {
  const label = outfile.split('/').pop() ?? outfile;

  const run = () =>
    build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: 'iife',
      minify: true,
      // Nothing here is served with a sourcemap, and one would be the only file
      // in the output handing out its own source.
      sourcemap: false,
      legalComments: 'none',
      ...esbuild,
    });

  return {
    name: `kroma:standalone-script:${label}`,
    ...(emit === 'start'
      ? {
          async buildStart() {
            await run();
          },
        }
      : {
          async closeBundle() {
            await run();
          },
        }),
    configureServer(server) {
      // Watched explicitly because nothing imports the entry — without this, an
      // edit needs a dev-server restart to reach the client, which is exactly
      // the silent staleness this plugin exists to stop.
      server.watcher.add(entry);
      server.watcher.on('change', (file) => {
        if (file === entry) run().catch((err: unknown) => server.config.logger.error(String(err)));
      });
    },
  };
}
