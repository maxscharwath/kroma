# KROMA marketing website

The landing page at **https://kroma.tv**, built with **Astro + Tailwind v4**
and served as a Cloudflare Worker with static assets only.

## Architecture

- `src/pages/index.astro` composes the page from small components.
- `src/components/*.astro` one section per file; markup + scoped styles live
  together (Tailwind utilities for the simple bits, scoped CSS for the
  intricate ones).
- `src/data/*.ts` all copy as typed data (facts, pipeline, screens, features,
  FAQ). The FAQ data also feeds the FAQPage JSON-LD in `layouts/Base.astro`.
- `src/scripts/beams.ts` the WebGL hero background: a fragment-shader
  recreation of the intro film's radial neon burst (three counter-rotating
  beam layers, hashed per-beam color/width/reach/flicker). Pauses off-screen,
  caps its buffer resolution, renders a single frame under
  `prefers-reduced-motion`, falls back to a still film frame without WebGL.
- `src/scripts/interactions.ts` copy buttons, FAQ accordion, entry reveals,
  one rAF loop for the scroll mask + parallax, magnetic CTAs.
- `src/styles/global.css` Tailwind v4 `@theme` tokens (the brand palette,
  fonts) plus the shared component classes (`.d1/.d2`, `.label`, `.btn`,
  reveals).
- `public/img/` real product screenshots (webp, 1200w + 2200w), captured from
  a live install with a headless-Chrome rig at 1600x1000 @2x.

## Develop / deploy

```bash
cd packages/website
bun run dev      # local dev server
bun run build    # static build -> dist/
bun run deploy   # astro build + CI=1 wrangler deploy
```

Wrangler gotchas (4.x, non-interactive):

- Without `CI=1`, wrangler exits **silently after the banner** whenever it
  wants a confirmation.
- A deploy that (re)provisions the `kroma.tv` custom domain asks a confirm
  that even `CI=1` does not auto-accept; feed it via stdin:
  `printf 'y\n' | CI=1 bunx wrangler deploy`. Once the domain exists, plain
  `CI=1` deploys are enough.
