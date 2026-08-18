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
        "dependencies": { "tv.kroma.x": "^0.1.0" },
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

### 2. `dependencies`, and where a package comes from

**Rename `dependsOn` → `dependencies`** (and `optionalDependsOn` → `optionalDependencies`).
These are the exact npm names — one less bit of vocabulary to learn, and no camelCase
coinage. The manifest bumps to `apiVersion: 2`; the loader accepts the old keys during a
transition so nothing installed breaks.

A dependency value is a **plain version range** — the whole DX goal is that the common line
stays boring:

```jsonc
"dependencies": { "tv.kroma.torrents": "^0.1.0" }
```

Where a package *comes from* is answered centrally, the way Gradle's `repositories { … }`
and npm's `.npmrc` scopes do — never by cluttering each dependency line. A module id is a
reverse-DNS group (`tv.kroma.acquisition`, exactly Maven's convention), and a small
`registries` map routes a group prefix to a registry, longest-prefix-wins, default = Kroma:

```jsonc
"registries": { "com.acme": "https://modules.acme.dev" }
```

So a dependency on `com.acme.foo` resolves against Acme's registry with **one line of
config**, and `tv.kroma.*` needs nothing (it is the default). This is the Gradle model:
a package can depend on a package from another repository, and the repository is declared
once, not repeated on every dependency.

**Escape hatch (rare):** for a genuine one-off source — a git ref, a tarball URL, a pinned
registry for a single dependency — the value may be an npm-style inline **string protocol**,
never a nested object:

```jsonc
"dependencies": {
  "tv.kroma.torrents": "^0.1.0",                 // default registry
  "com.acme.foo": "^1.2.0",                        // Acme registry, via registries map
  "dev.fork.bar": "git+https://…/bar#^0.3.0",      // one-off git source
  "corp.internal.x": "^2.0.0@https://npm.corp"     // one-off pinned registry
}
```

The bare range is the 95% path; the protocol string is there for the 5% without ever forcing
an object. Modern, familiar (it is literally npm's dependency-string grammar), and it keeps
`dependencies` a flat `id → string` map.

### 3. Resolving an unknown registry (trust on first use)

When you install a module that depends on something from *another* registry, the source has
to be **detectable** and the user **warned before anything is fetched from a host they never
approved**. Resolution of a dependency's group prefix walks this order:

1. **Host-trusted registries** — the `registries` config on this server/machine. Explicit,
   already approved, used silently.
2. **The installing module's declared registries** — a published module carries its own
   `registries` map for the groups its dependencies need (so `com.acme.foo` ships "my
   `com.acme.*` come from `https://modules.acme.dev`"). This makes the source *self-describing*
   and therefore detectable: the resolver knows exactly which host a dependency wants.
3. **The default registry** — *anything* with no matching override resolves against the
   default (Kroma). This is the npm rule: the default registry serves every id unless a
   scope/prefix has an explicit override — so `com.acme.foo` with no `com.acme` entry is simply
   looked up on `modules.kroma.tv`, and if it is not there the result is an ordinary
   *"module not found"*, exactly as `npm install @acme/x` 404s on the default registry when no
   `@acme:registry` is set. No special "undeclared group" failure — the default just catches it.

So the `registries` map is *purely an override*: you touch it only to send a prefix somewhere
other than the default. `tv.kroma.*` needs nothing; `com.acme.*` needs one line only if Acme
runs its own registry.

The one case that warns is an override (from config **or** step 2, a module's own declared
`registries`) that points at a host the user has **not** trusted yet — a
**trust-on-first-use prompt**, not a silent fetch:

> `com.acme.foo` wants modules from a new registry: **modules.acme.dev**. Trust it and fetch?
> [once] [always] [no]

*always* promotes it into the trusted `registries`; *once* uses it for this install only;
*no* fails closed. This is the cargo/npm posture: the default serves by default, but the first
time a *new* registry is introduced, pulling from it is a conscious user decision. Nothing is
fetched, verified or loaded from a host the user has not trusted.

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

## Security

A third-party plugin registry is a supply chain, so trust is verified at every hop, and the
**server refuses to load anything it has not checked** — defence in depth on top of the
existing out-of-process module isolation.

- **Integrity, checked twice.** Every artifact carries `integrity` (`sha256-<base64>`, SRI
  form). The installer and the **server (`kroma-module-kernel`) both hash the downloaded
  `.kmod` and compare before it is ever unpacked or loaded** — a mismatch is a hard refusal,
  logged with the expected vs actual digest. Even a compromised CDN cannot serve tampered
  bytes undetected. The metadata's `integrity` is itself covered because it is fetched over
  TLS from the registry the group-prefix routing pins, so a rogue host cannot answer for
  `tv.kroma.*`.
- **Dependency closure verified before load — on the server.** At install the server resolves
  the *full* transitive closure and refuses the operation unless: every `dependencies` range
  is satisfied by a resolvable version, every `optionalDependencies` that is present is in
  range, every `requires` capability `kind` is provided by some module in the set, `minServer`
  is met, and the graph is acyclic. No module is loaded from a set that does not fully
  resolve — the same checks `workspace-tools verify` runs at publish, re-run authoritatively
  at install against what is actually there. A partial or contradictory install is rejected
  whole, not loaded half-way.
- **Provenance by signature (not just integrity).** `integrity` proves the bytes match the
  metadata; it does **not** prove *who* published them. Each version therefore carries an
  optional `signature` over its manifest+artifact digests and a publisher `keyId`; the server
  holds a trust policy — `open` (any), `signed` (a valid signature by any key), or `pinned`
  (an allow-list of `keyId`s per group prefix). The Kroma registry ships `signed`; a private
  registry can demand `pinned`. Signing is opt-in at v2 but the fields are reserved now so the
  wire format need not break to add it.
- **No install-time code execution.** A `.kmod` is data (a zstd tar of a manifest, an icon, a
  compiled sidecar); resolution and verification never execute publisher-supplied scripts (the
  npm `postinstall` class of attack has no surface here). Execution happens only after
  verification, and only in the sandboxed out-of-process host.
- **Failure is loud and safe.** Every rejection (bad hash, unmet dependency, untrusted
  signature, unreachable registry) fails closed with a specific error; the server never
  degrades to "load it anyway".

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

- **Signature key distribution and rotation.** The `signature`/`keyId` fields and the
  server trust policy are specified above, but *how a publisher's public key is discovered and
  rotated* (a `/keys.json` on the registry? a well-known transparency log, sigstore-style?) is
  left for a focused security follow-up before `signed`/`pinned` is enforced by default.
- **Yank/deprecate.** A way to mark a version withdrawn without deleting it (npm `deprecate`),
  and how the server treats an installed module whose version was later yanked.
- **Implementation is several PRs**, not one: (a) manifest fields + generator + `Registry`
  client, (b) the site UI, (c) the server install path. This RFC is the contract they share.
