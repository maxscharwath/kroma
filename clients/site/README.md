<div align="center">
  <img src="../../.github/assets/logo.svg" alt="KROMA" height="52">
  <h1>@kroma/site</h1>
  <p><i>The KROMA showcase site — kroma.tv. Marketing pages + an MD/MDX blog, prerendered to static HTML on Cloudflare.</i></p>
</div>

> Part of the [KROMA](../../README.md) monorepo. It reuses the design system from
> [`@kroma/ui`](../../packages/ui/README.md) — the same deep-charcoal + amber
> tokens, the same two type families — so the site renders in the exact brand of
> the app, with no second source of truth.

## What it is

A **TanStack Start** app built in **fully static** mode: every page is prerendered
to its own `index.html` at build time (no server runtime), so Cloudflare serves it
straight from the edge — the same assets-only pattern as [`clients/tv-web`](../tv-web).
Chosen because it matches the house web stack ([`clients/web`](../web) is also
TanStack Start) while giving a marketing site the SEO of real per-page HTML.

- **Framework:** TanStack Start + TanStack Router (file-based routes in `src/routes`).
- **Styling:** Tailwind **v4**, importing `@kroma/ui/tailwind.css` (the kit's
  `@theme`) — utilities like `bg-bg`, `text-accent`, `font-display` are the KROMA tokens.
- **Blog:** `.mdx` files in [`content/blog/`](./content/blog), compiled with
  `@mdx-js/rollup` (frontmatter, GFM, anchored headings, Shiki code). See the
  [authoring guide](./content/blog/README.md).

## Develop

```bash
bun install                          # from the repo root, once
bun run --filter '@kroma/site' dev   # http://localhost:3100
```

Other scripts (run with `bun run --filter '@kroma/site' <script>`):

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server on :3100 |
| `build` | Prerender every page → `dist/client` (static) |
| `preview` | Serve the built output locally |
| `preview:edge` | Serve it through `wrangler dev` (the real edge runtime) |
| `typecheck` | `tsr generate` + `tsc --noEmit` |
| `deploy` | Build, then `wrangler deploy` |

## Add a page

Drop a file in `src/routes/` — it becomes a route by its path
(`src/routes/about.tsx` → `/about`). Give it a `head` that spreads `seo(...)` from
[`src/lib/seo.ts`](./src/lib/seo.ts) so it ships a complete title + Open Graph
card, and it will be picked up by the prerender crawl as long as something links
to it.

## Add a blog post

Create one `.mdx` file in [`content/blog/`](./content/blog) with a frontmatter
block. That's the whole workflow — it's discovered, prerendered, dated and
sorted automatically. Full details and the frontmatter fields are in the
[authoring guide](./content/blog/README.md).

## Deploy

The site is an **assets-only Cloudflare Worker** ([`wrangler.jsonc`](./wrangler.jsonc)),
served at `kroma.tv` + `www.kroma.tv` (the 10-foot app lives at `tv.kroma.tv` —
see `clients/tv-web`). Requires the `kroma.tv` zone on the Cloudflare account;
`wrangler` provisions the custom domains on deploy.

```bash
bun run --filter '@kroma/site' deploy
# or, if dist/ is already built:
cd clients/site && bunx wrangler@4 deploy
```

## Layout

```
clients/site/
├─ content/blog/       the blog, one .mdx per post (+ authoring guide)
├─ public/             static assets served as-is (favicon, og image)
├─ src/
│  ├─ components/      site chrome + section components (DOM + Tailwind v4)
│  ├─ lib/             site config, SEO head helper, blog data layer
│  ├─ routes/          file-based routes (home, download, blog, privacy, support)
│  └─ styles.css       imports @kroma/ui/tailwind.css + site-only @utility/@theme
├─ vite.config.ts      TanStack Start (static prerender) + MDX pipeline
└─ wrangler.jsonc      assets-only Cloudflare Worker (kroma.tv)
```
