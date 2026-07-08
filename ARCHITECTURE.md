# LUMA architecture

> North-star for the in-progress structural migration. Decided by a senior-architect
> review (onion vs modular vs hybrid vs DDD). Verdict: a **domain-columnar polyglot hybrid**.

## The one idea

A single vocabulary of **domain nouns** organizes the whole repo:

```
media · accounts · playback · library · admin · discovery
```

Each side of the wire expresses those nouns in the shape that matches how it changes:

- the **Rust server is layered** (I/O dominates → separate the rings),
- the **React frontends are feature-sliced** (screens dominate → group by feature).

The same noun names the server's layer-files *and* the client's feature-folders, so you can
navigate the UI by knowing the server, and vice-versa.

## Monorepo layout (target)

Split by **role**, not by accident of history:

```
apps/        deployables have an entry point, ship
  server/      Rust binary (embeds the web build)
  web/         Web SPA
  tv/          10-foot TV app
packages/    shared libraries imported by ≥2 apps
  core/        @luma/core: pure rules + outbound adapters (re-exports @luma/client)
  ui/          @luma/ui: presentational primitives + shared hooks/providers
clients/     platform shells / packaging that wrap an app for a host
  tizen/  webos/  synology/
```

Rule of thumb: has a `main()`/entry and ships → `apps/`. Imported by two apps → `packages/`.
Only adapts/packages an app for a device → `clients/`.

## Server (Rust) layered, domain as the column

The server is a **cargo workspace**. The layers are crates, so the "inward-only"
dependency rule is enforced by the compiler (an illegal `use` won't resolve),
not by convention or a CI grep. The binary is a thin HTTP shell over the engine:

```
server/
  src/                 luma-server BINARY — main.rs + api/ (router + handlers), 8k LOC
  crates/
    luma-engine/       infra + services + state + i18n + model  (the business logic, 20k LOC)
    luma-db/           all SQL, one shared Pool                 (persistence, 7k LOC)
    luma-domain/       entities + PURE rules (serde only, no I/O)
    luma-config/       env-parsed Config
    luma-i18n/         translate + CLDR plurals (Rust port of @luma/core i18n)
    luma-primitives/         timestamps · short hashes · random tokens (below db)
    luma-whisper/   Whisper transcription (candle)   ── heavy/optional dep graphs,
    luma-vector/        content embeddings (candle)      ── isolated behind features so
    luma-mdns/    mDNS advertising                 ── editing the server doesn't
    luma-http/ luma-scene/ luma-torznab/ luma-torrent/   the acquisition stack
```

**Dependency graph (acyclic, compiler-enforced):**

```
luma-server(bin) → luma-engine → { luma-db, luma-whisper, luma-vector, luma-mdns,
                                    luma-http, luma-scene, luma-torznab, luma-torrent }
       luma-db → luma-domain, luma-primitives        everything → luma-domain / luma-config
```

- **`luma-domain`** depends only on serde **never** axum/rusqlite/reqwest/process.
  Purity is compiler-enforced, so no CI grep is needed.
- The layer modules keep their historical paths (`crate::db`, `crate::services`,
  `crate::model`, …) via crate aliases, so call sites were untouched by the split.
- Heavy or optional dependencies (candle, mdns) live in leaf crates behind the
  `whisper-*` / `semantic-embeddings` features, forwarded binary → engine → leaf.
- `services/` may use db/infra/domain; never api. `api/` translates HTTP↔services, holds no business logic.
- `main.rs` + `state.rs` are the only composition points.
- **Cross-cutting joins** are owned by the consuming domain (e.g. `continue_watching` in `db/playback.rs`, admin history in `db/admin.rs`). One Pool; "a domain owns its tables" is a convention, not a wall.
- **Thin domains** (discovery, quickconnect) may collapse the layer spread to a single file don't force the full ladder on tiny domains.

## Frontend (React) feature slices

```
apps/tv/src/   app/(shell + providers + router)  features/{catalog,playback,accounts}/  shared/
apps/web/src/  features/{catalog,playback,admin}/  routes/ = thin re-exports
```

**Dependency rule:** `features/* → shared/* → @luma/ui → @luma/core`.

- A feature **must not import a sibling feature** shared code moves to `shared/` or up into `@luma/ui`. (Biome-guarded.)
- Wire types come only from `@luma/core` (the generated barrel); never hand-redefined.

## File-size policy

Hard-split files **> 300 LOC**; split **200–300** only at a natural seam; aim for ~150.
The **domain seam is the cut line** split a god-file where a domain/layer boundary already
runs through it, never at an arbitrary line. Exempt: `generated/`, vendored, data/locale JSON,
lockfiles, `*.gen.ts`, irreducible adapters (ffmpeg flag-builders).

## Migration phases

| # | Phase | Status |
|---|-------|--------|
| 0 | Guardrails (CI: domain-purity guard; zod schemas are the wire-type source of truth) | in progress |
| 1 | Server god-file split by domain (`db.rs`, `model.rs` → `db/`, `domain/`) | pending |
| 2 | Server layering (`infra/` + `services/` + `api/` column + `extract.rs`) | pending |
| 3 | Monorepo move (`packages/tv→apps/tv`, `clients/web→apps/web`, `server→apps/server`) | pending |
| 4 | Frontend feature slices (TV then web) | pending |
| 5 | Hardening (`api.ts` per-domain sub-clients) | pending |
| 6 | Server workspace split — 14 crates (1 bin + 13 libs), binary is a thin `api` shell over `luma-engine`; layers compiler-enforced | ✓ done |

Each phase is independently shippable and verified (`cargo test` · `bun run typecheck`/`build` ·
for Phase 3, a full `.spk` build that serves the SPA).
