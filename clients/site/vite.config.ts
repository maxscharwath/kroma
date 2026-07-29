import { fileURLToPath } from 'node:url';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// A remark plugin that counts the words in a post and injects
// `export const readingMinutes = N` into the compiled module, so the blog index
// can show a reading estimate without a second `?raw` import of the source (which
// the MDX plugin claims and returns as a component, not text). Compile-time, so
// every post carries its own number with no runtime work.
type MdastNode = { type: string; value?: string; children?: MdastNode[] };
function countWords(node: MdastNode): number {
  let n = 0;
  if ((node.type === 'text' || node.type === 'code' || node.type === 'inlineCode') && node.value) {
    n += node.value.trim().split(/\s+/).filter(Boolean).length;
  }
  for (const child of node.children ?? []) n += countWords(child);
  return n;
}
function remarkReadingTime() {
  return (tree: MdastNode) => {
    const minutes = Math.max(1, Math.round(countWords(tree) / 200));
    tree.children?.unshift({
      type: 'mdxjsEsm',
      value: `export const readingMinutes = ${minutes};`,
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExportNamedDeclaration',
              specifiers: [],
              source: null,
              declaration: {
                type: 'VariableDeclaration',
                kind: 'const',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: { type: 'Identifier', name: 'readingMinutes' },
                    init: { type: 'Literal', value: minutes },
                  },
                ],
              },
            },
          ],
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: mdast node shape from the plugin API.
    } as any);
  };
}

// The showcase site is a fully STATIC build: TanStack Start prerenders every page
// it can reach from the entry links to its own HTML file, and the SPA shell is the
// fallback for anything unmatched. The output is plain files (dist/client) that
// Cloudflare serves from the edge with no server runtime — see wrangler.jsonc.
export default defineConfig({
  plugins: [
    tailwindcss(),
    // MDX must compile BEFORE the React transform (enforce: 'pre'). Frontmatter
    // is lifted to `export const frontmatter` (remark-mdx-frontmatter) so the blog
    // index can read a post's title/date/excerpt without rendering it; GFM gives
    // tables and task lists; rehype-slug + rehype-pretty-code give anchored
    // headings and Shiki-highlighted code blocks in the deep charcoal theme.
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm, remarkReadingTime],
        rehypePlugins: [
          rehypeSlug,
          [rehypePrettyCode, { theme: 'github-dark-default', keepBackground: false }],
        ],
      }),
    },
    tanstackStart({
      // Crawl the link graph from the entry and write each reachable route to its
      // own HTML file (dist/client/index.html, /download/index.html, …). The blog
      // index links every post, so dropping in an .mdx file and listing it is all
      // it takes for that post to be prerendered — no route or config to touch.
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
