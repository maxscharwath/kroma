# RFC 110: a normalized Module Registry API anyone can host

- Status: **DRAFT**
- PR: #110
- Affects: `apps/modules` (the `modules.kroma.tv` site/worker), `packages/module-tools` (the catalog generator), `server/crates/kroma-module-kernel` (install/resolve), `.github/workflows/modules.yml`

## Summary

Formalize the catalog `packages/module-tools` already produces (`Entry` / `Artifact`
with `sha256` integrity and per-target bundles) into a **versioned, static-hostable HTTP
contract** — so `modules.kroma.tv` is merely the *reference* registry, and anyone can host a
compatible one behind a plain file server. Add the metadata a store needs (author, tags,
keywords, homepage, license) and a **search index**, both derived at publish time. Route a
dependency to a registry by its reverse-DNS **group prefix** (Gradle-style), defaulting to
the Kroma registry. Ship a small typed `Registry` client that `workspace-tools` verify and
the server install path both consume.

## Motivation

The pieces exist but nothing is a contract: the catalog shape lives in a TypeScript type,
the URL layout is implicit, there is no documented way for a third party to publish or host
modules, no search, and no author/tag metadata for a store page. To let anyone run a KROMA
module registry — the stated goal — the wire format has to be *specified*, *versioned*, and
*verifiable*, not merely *emitted*.

## Proposal

### 1. The wire format (static, HTTP GET only)

A registry is a set of JSON files a plain file host (Cloudflare, Pages, S3, nginx) can serve
— no server logic required, which is what makes it universally hostable.

- **`GET /registry.json`** — the descriptor and index:
  ```jsonc
  {
    "apiVersion": 1,
    "name": "KROMA modules",
    "url": "https://modules.kroma.tv",
    "modules": ["tv.kroma.torrents", "tv.kroma.acquisition"] // ids; details are per-module
  }
  ```
- **`GET /m/{id}.json`** — one module's full record (the "packument"): the current
  `Manifest` fields plus the new store metadata, and every version's artifacts:
  ```jsonc
  {
    "apiVersion": 1,
    "id": "tv.kroma.torrents",
    "name": "Torrents",
    "description": "…",
    "author": "Max Scharwath",
    "homepage": "https://…",
    "license": "GPL-2.0-or-later",
    "keywords": ["download", "torrent"],
    "tags": ["download-client"],           // capability kinds it provides, for filtering
    "icon": "…",
    "latest": "0.1.7",
    "versions": {
      "0.1.7": {
        "minServer": "0.1.4",
        "dependsOn": { "tv.kroma.x": "^0.1.0" },
        "provides": [ … ], "requires": [ … ],
        "artifacts": [
          { "target": "x86_64-linux", "url": "…/tv.kroma.torrents-0.1.7-x86_64-linux.kmod",
            "size": 12345, "integrity": "sha256-…", "contentHash": "sha256-…" }
        ]
      }
    }
  }
  ```
- **`GET /search/index.json`** — a **trimmed** search index: one small record per module
  (`id`, `name`, one-line `description`, `keywords`, `tags`, `latest`) — *not* the full
  packument. ~120 bytes/module, so 3 000 modules ≈ 350 KB gzipped-to-~80 KB, shipped once and
  cached; the full record is fetched from `/m/{id}.json` only when a user opens a module.
  See **Scaling** below for what happens past that.
- **The bundles** stay where they are (release assets today); `artifacts[].url` is absolute,
  so the metadata and the bytes can live on different hosts.

`integrity` is **mandatory** (`sha256-<base64>`, Subresource-Integrity form): the installer
verifies every downloaded bundle against it. This is the non-negotiable that makes a
third-party registry safe — a compromised host cannot serve tampered bytes undetected. The
`sha256` field already emitted by `module-tools` becomes this, just reformatted.

### 2. Choosing a registry: group-prefix routing

A module id is a reverse-DNS group (`tv.kroma.acquisition`), exactly Maven's convention. A
client maps a group prefix to a registry, longest-prefix-wins, default = Kroma:

```jsonc
{ "tv.kroma": "https://modules.kroma.tv", "com.acme": "https://modules.acme.dev" }
```

`dependsOn` values stay bare ranges — no inline registry, no per-dependency object (that is
not how npm or Gradle expresses a registry either). A third-party module `com.acme.foo`
resolves against its own registry automatically.

### 3. The typed client

A `Registry` interface (in `workspace-tools`, reused by the server SDK):
`descriptor()`, `module(id)`, `resolve(id, range) → { version, artifact, manifest }`,
`search(query)`. One HTTP implementation covers any conforming registry; `verify` uses
`resolve` to confirm an external dependency exists and its integrity is present.

### 4. Where it lands

- **`module-tools`** (generator): emit `registry.json`, `m/{id}.json`, `search.json`, with
  the new metadata read from each `module.json` (`author`, `keywords`, `tags`, `homepage`,
  `license` — added as optional manifest fields). Reformat `sha256` → `integrity`.
- **`apps/modules`** (`modules.kroma.tv`): serve those files (already a Cloudflare worker),
  and add a store UI — a searchable list + a per-module page reading `search.json` /
  `m/{id}.json`.
- **`server/crates/kroma-module-kernel`**: resolve + install through the `Registry` contract,
  verifying `integrity` before load, honouring the group-prefix routing config.

## Scaling (what happens at 3 000 modules)

The design is deliberately O(1) where it matters and never scans the registry to do its job.

- **Resolve / install — already optimal, unbounded.** `resolve(id)` fetches one static file,
  `/m/{id}.json`, straight from a CDN edge. It never lists or scans the registry. 3 000 or
  3 000 000 modules is the same single cache-hit request — this is exactly how Maven Central
  (millions of artifacts) and the npm registry serve as static blobs.
- **Generation — incremental, not full-rebuild.** Publishing one module regenerates only that
  module's `/m/{id}.json` and patches its one line in the index; it does **not** re-emit 3 000
  files. Cost is O(changed), not O(registry).
- **Search — the one thing that must not ship everything.** The trimmed `/search/index.json`
  (~80 KB gzipped at 3 000) is fine to ship once and filter client-side. Past a threshold the
  same path is served in tiers, transparently to clients:
  1. **Sharded index** — `/search/index/{aa}.json` sharded by id prefix, so a client fetches
     only the shards a query touches. Still fully static.
  2. **Query endpoint** — a registry that outgrows even that puts a real search service behind
     `/search?q=…`. This is the *only* place a large registry needs server logic; the static
     floor (descriptor, per-module, sharded index) still lets anyone host without it.
- **`workspace-tools` verify — linear.** Building the local graph is O(modules) file reads and
  O(edges) range checks; the topological order is O(V+E). 3 000 local modules is a sub-second
  pass, and `affected` only walks the reverse edges it needs.

Net: nothing in resolution, install or verification degrades with registry size; only *search*
tiers up, and it tiers without breaking the static-hostable contract.

## What this costs

- A **published contract is a compatibility promise**: `apiVersion` must be bumped and old
  shapes tolerated once third parties depend on it. That is the point, but it is a cost.
- **Metadata now lives in `module.json`** (author/keywords/tags) — a small authoring burden,
  validated at publish.
- **Integrity enforcement** can reject an already-installed bundle if a registry rehashes
  incorrectly; the installer needs a clear error, not a silent refusal.

## Compatibility

- The current `Entry`/`Artifact` catalog is a strict subset; the generator keeps emitting the
  Schema-1 mirror during a transition so existing consumers do not break.
- Installed modules and their `tv.kroma.<id>@<version>` release tags are unaffected — only the
  *served metadata* is normalized and extended.

## Alternatives

- **Dynamic registry API (npm-style server).** Rejected as the baseline: it raises the bar to
  host from "serve files" to "run a service". A large registry MAY put a query endpoint behind
  `search.json`, but the floor stays static.
- **Per-dependency inline registry.** Rejected — neither npm (`.npmrc` scopes) nor Gradle
  (repository `content` filters) puts the registry in the dependency line; group-prefix routing
  matches both.
- **Do nothing.** The catalog stays a private implementation detail and no one can host a
  registry — the opposite of the goal.

## Unresolved

- **Signing beyond integrity.** `sha256` proves the bytes match the metadata; a *signature*
  would prove who published them. Probably a follow-up (a `signature`/`publicKey` field), but
  the field should be reserved now.
- **Yank/deprecate.** A way to mark a version withdrawn without deleting it (npm `deprecate`).
- **Implementation is several PRs**, not one: (a) manifest fields + generator + `Registry`
  client, (b) the site UI, (c) the server install path. This RFC is the contract they share.
