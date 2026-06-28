---
name: luma-design
description: Use this skill to generate well-branded interfaces and assets for LUMA (a cinematic, multi-platform self-hosted video streaming app), for production or throwaway prototypes/mocks. Contains design guidelines, colors, type, fonts, and tokens for prototyping.
user-invocable: true
---

Read README.md in this skill, then explore the token CSS in `tokens/` and the specimen cards in `guidelines/`. The full reference UI is `LUMA.dc.html`.

Core rules: deep charcoal (#0A0A0C) backgrounds, ONE warm amber accent (#F4B642), Bricolage Grotesque for display + Hanken Grotesk for UI, French copy in sentence case, NO emoji (use text codes like FR/EN/4K/HDR), soft layered shadows, pill chips, generous negative space, amber focus rings for TV. 

If creating visual artifacts (slides, mocks, prototypes), copy assets out and create static HTML linking `styles.css`. If working on production code, read the rules here and use the CSS custom properties. If invoked without guidance, ask what the user wants to build, then act as an expert LUMA designer outputting HTML artifacts or production code.
