# RFC NNNN: a normalized Module Registry API anyone can host

- Status: **DRAFT**
- PR: #NNNN
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
- **`GET /search.json`** — a prebuilt search index (id, name, description, keywords, tags,
  author, latest). Small enough to ship whole and filter client-side; a large registry can
  swap in a query endpoint behind the same path without clients noticing.
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
