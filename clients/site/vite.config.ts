import { fileURLToPath } from 'node:url';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mdxPlugin } from './vite/mdx';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// The showcase site is a fully STATIC build: TanStack Start prerenders every page
// it can reach from the entry links to its own HTML file, and Cloudflare serves
// the output (dist/client) from the edge with no server runtime — see
// wrangler.jsonc. The MDX pipeline lives in ./vite/mdx.ts.
export default defineConfig({
  plugins: [
    tailwindcss(),
    mdxPlugin(),
    tanstackStart({
      // Crawl the link graph from the entry and write each reachable route to its
      // own HTML file (dist/client/index.html, /download/index.html, …). The blog
      // index links every post, so dropping in an .mdx file is all it takes for
      // that post to be prerendered — no route or config to touch.
      //
      // No `spa` mode: it would mask `/` as a content-agnostic shell and suppress
      // the per-page HTML this content site needs for SEO. Cloudflare's
      // single-page-application fallback (wrangler.jsonc) serves the home HTML for
      // an unmatched path, which then client-renders the branded 404.
      prerender: { enabled: true, crawlLinks: true },
      // A sitemap.xml for the prerendered pages, hosted at the apex.
      sitemap: { enabled: true, host: 'https://kroma.tv' },
    }),
    react(),
    // Paraglide compiles messages/{locale}.json into tree-shakeable message
    // functions under src/paraglide (generated, git-ignored). It runs AFTER
    // tanstackStart so the generated module exists before the app graph is built.
    //
    // `strategy: ['url']` only, deliberately. A cookie or an Accept-Language
    // sniff would make the locale a function of the REQUEST, and this site is
    // prerendered to static files: a page must be one language per URL or the
    // HTML on the CDN would contradict itself. The URL is the single source of
    // truth, which is also what makes /fr indexable.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url'],
      // The generated output is JavaScript, so without this `tsc` sees `any` for
      // every message function and the runtime - which would quietly undo the
      // typesafety that is half the reason for choosing a compiler-based i18n.
      emitTsDeclarations: true,
      // English (the base locale) at the clean root, every other locale under its
      // own prefix. Listing `fr` FIRST matters: the patterns are matched in order
      // and the `en` entry is a catch-all that would otherwise swallow /fr/*.
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [
            ['fr', '/fr/:path(.*)?'],
            ['en', '/:path(.*)?'],
          ],
        },
      ],
    }),
  ],
  resolve: {
    alias: [{ find: '#site', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
    // bun installs per workspace, so React can otherwise be linked twice and hooks
    // blow up. @kroma/ui is consumed as raw source (below), so its React must be
    // this app's React.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Allow importing TS source from the workspace packages (@kroma/ui tokens).
    fs: { allow: [repoRoot] },
  },
  // @kroma/ui ships raw TS source, so bundle it for SSR/prerender rather than
  // externalizing it (Node cannot import its `.ts` files directly).
  ssr: {
    noExternal: ['@kroma/ui'],
  },
});
