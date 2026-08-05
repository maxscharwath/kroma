# Module registries

A **registry** is any static host serving a catalog index (`modules.json`) plus
the `.kmod` files it points at. The Store (Admin → Modules) reads every
configured registry and shows the union.

## The list

| | |
|---|---|
| **Official** | Pinned first, cannot be removed or disabled. Points at the `modules.json` attached to this project's GitHub Releases; the URL is editable (`moduleRegistryUrl`) so it can be aimed at a mirror or a private build. |
| **Added** | Any number of operator-added registries (`moduleRegistries`), each with a name, an https URL and an enabled flag. |

**Official always wins.** When two registries publish the same module id, the
higher-precedence one supplies it and the other's copy is hidden — reported per
registry as `shadowed`. Precedence is official first, then the configured order.
A third-party registry therefore cannot take over an official module id, not
even by publishing a higher version.

## What adding a registry does and does not grant

Adding a registry only makes its modules **appear in the list**. It is not a
trust grant. Every install still goes through the same gate:

- an added registry's catalog URL must be **https** — the catalog is what names
  the artifact URL *and* the checksum to check it against, so fetching it over
  cleartext would hand a MITM both halves and make the verification worthless.
  (The official slot still accepts any scheme: it is one deliberate override and
  predates the list.)
- the artifact URL must be **https**,
- the catalog must publish a **sha256**, and the downloaded bytes must match it —
  a module with no checksum is refused,
- `minServer` is enforced at install **and** at spawn,
- the catalog fetch is bounded by a timeout and a size cap, and an entry's
  `icon` is only accepted as a small inline `data:` image.

That said, a module is a **native binary that the server executes**. Adding a
registry you do not control is equivalent to trusting its operator with code
execution on the host. The list is admin-only (`settings.manage`) for that
reason.

One unreachable registry does not blank the Store: its failure is reported on
its own row and the others still contribute.

## Publishing one

`scripts/gen-registry.ts` turns the packed `.kmod` files into a publishable
tree — the catalog plus the bundles it points at:

```bash
bun run modules:pack                                             # -> dist/modules/*.kmod
bun run scripts/gen-registry.ts --base https://mods.example.com  # -> dist/registry/
```

`--base` is the URL the files will be served from; it becomes each artifact's
`url`. Output is `dist/registry/{catalog.json, <id>[-<target>].kmod, …}` — upload
that directory as-is and point the registry entry at its `catalog.json`.

Schema 2, one entry per module, with per-target artifacts:

```json
{
  "schema": 2,
  "modules": [
    {
      "id": "tv.kroma.notes",
      "name": "Notes",
      "version": "0.2.0",
      "description": "...",
      "minServer": "0.1.4",
      "library": false,
      "dependsOn": { "tv.kroma.torrents": "^0.1.0" },
      "artifacts": [
        {
          "target": "x86_64-unknown-linux-musl",
          "url": "https://example.org/tv.kroma.notes-x86_64-unknown-linux-musl.kmod",
          "size": 8123456,
          "sha256": "…"
        }
      ]
    }
  ]
}
```

`target` is the Rust triple the binary was built for; omit it only for a library
module (manifest + frontend, no native binary), which runs anywhere. The server
picks an exact target match first, then a platform-independent bundle, then a
musl build of the same architecture — static, so it also runs on glibc.

Schema 1 (a flat `url` / `size` / `sha256` per module, no target) still parses as
a single platform-independent artifact.

Host `modules.json` and the `.kmod` files anywhere that serves them over https —
GitHub Releases, GitHub Pages, an S3 bucket, a NAS — then add the URL under
Admin → Modules → Registries.
