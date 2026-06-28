# LUMA — Design System

LUMA is a self-hosted, multi-platform **video streaming** experience (think a personal Netflix/Plex) covering **Web (desktop), TV (10-foot remote) and Mobile**. The library streams local media; the brand voice is cinematic, calm and premium. The reference application lives in this project as `LUMA.dc.html` (full clickable prototype: profiles, home, detail, player, search, requests, settings).

**Source:** designed from scratch in this project (no external brand). The live reference is the LUMA prototype (`LUMA.dc.html`).

## Content fundamentals
- **Language:** French (fr-FR). Sentence case for copy; ALL-CAPS only for short overlines/section labels ("EN VEDETTE", "DISTRIBUTION", "SAISONS").
- **Tone:** sober, confident, cinematic. Short editorial synopses, no hype, no exclamation. Address the viewer with **vous** implicitly (e.g. "Reprendre", "il reste 1h19", "Demander ce titre").
- **No emoji.** Language and quality info use **text codes** (FR, EN, JP, VF, VO, 4K, HDR, H.265, 5.1, Atmos), never flag emoji.
- **Numbers/metadata** are terse and dot-separated: `2024 · 2h08 · Thriller SF`, `Saison 2 · 8 épisodes`.
- **Status copy** is plain: "Disponible", "Téléchargement", "En file d'attente", "Vu", "En cours".

## Visual foundations
- **Mood:** deep near-black charcoal (`--luma-bg #0A0A0C`) with a single warm **amber** accent (`--luma-accent #F4B642`). One accent only; semantic colours (green/blue/violet/teal) are reserved for status + quality badges.
- **Backgrounds:** full-bleed **key-art** behind heroes and detail pages — multi-layer CSS gradients (directional lighting + depth) generated per title and tinted by genre. A faint **amber ambient glow** "breathes" and the hero art slowly drifts. A subtle dot **grain** overlay adds texture. Posters are generated the same way (no photographic imagery in the reference).
- **Colour vibe of imagery:** dark, moody, slightly warm; deep shadows, soft coloured rim-light.
- **Typography:** display = **Bricolage Grotesque** (tight tracking, big cinematic titles), UI/body = **Hanken Grotesk**. Numerals use `tabular-nums` in the player.
- **Corner radii:** posters/cards 13–16px, buttons 10px, pills/chips 999px, panels & modals 22px.
- **Cards:** flat dark fill, hairline border (`--luma-border`), soft drop shadow (`--shadow-card`); a bottom scrim gradient keeps title text legible over art. No coloured left-border accents.
- **Shadows:** layered & soft (no hard edges). Posters `0 10px 28px`, modals/panels `0 20px 50px`.
- **Transparency & blur:** overlays, the Spotlight, the platform switcher and the Audio/Subtitles panel use translucent fills + `backdrop-filter: blur` (vibrancy). Protection gradients (top/bottom scrims) sit over art rather than solid bars.
- **Hover (web):** cards lift (`translateY(-6px)`) and gain an amber ring; buttons brighten (amber → `--luma-accent-hover`).
- **Press:** buttons shrink to `scale(.95)` with a springy ease.
- **Focus (TV / 10-foot):** a bright amber ring (`--ring-focus`), a gentle scale-up, and on the active rail item a **breathing glow**. Focus is always visible and auto-scrolls into view.
- **Motion:** quick, refined — entrances fade+rise; easing `--ease-out`; press uses `--ease-spring`. Nothing bouncy or playful beyond the press feedback.
- **Layout:** generous negative space; left-aligned heroes; horizontal carousels ("rails"); fixed sidebar (web), top nav (TV), bottom tab bar (mobile).

## Iconography
- **Inline SVG, line icons**, 1.7–2.0px stroke, `currentColor`, rounded joins (Lucide-like). No icon font, **no emoji**, no PNG icons.
- The **logo/mark** is a minimal "aperture": a 2.4px amber ring with a solid amber centre dot, beside the wordmark **LUMA** (Bricolage Grotesque 800, letter-spacing .16em).
- Quality/language are rendered as **text-code pills**, never iconographic flags.

## Index
- `styles.css` — entry point (links fonts + all tokens).
- `fonts.css` — webfont imports (Bricolage Grotesque, Hanken Grotesk via Google Fonts — see Caveats).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Effects, Brand) shown in the Design System tab.
- `LUMA.dc.html` (project root) — the full reference application / UI kit.
- `SKILL.md` — portable skill manifest.

## Caveats
- Fonts are loaded from **Google Fonts** (`fonts.css`); no local binaries are bundled. If you need offline/self-hosted webfonts, provide the files and I'll add `@font-face` rules.
- This v1 ships **foundations** (tokens + specimen cards + guide). Reusable React **components** (Button, Badge, PosterCard, Chip, TrackRow…) and packaged **UI kits** per platform are the next iteration — the live `LUMA.dc.html` currently serves as the reference UI.
