---
name: naming
description: What things are called here. Kebab-case files named after their export, the suffix vocabulary (.test, .native.test, .web, .story, .fixtures, .gen), a component folder's layout, index files that only re-export, snake_case and it_ prefixes on the Rust side, and the symbol names that are always wrong (utils, helpers, V2, Enhanced, New). Use when creating a file or directory, naming a test file, adding a platform variant, or when a name has to change. Triggers - "what should I call this file", "where does this file go", "naming convention", "kebab or camel", "name this test".
---

# Naming

A name is read far more often than it is written, and a wrong one costs every
later reader a lookup. Two questions answer most cases: what does this file
export, and what suffix says how it is resolved.

## Files

**Kebab-case, named after its export.** `focusable.tsx` exports `Focusable`.
`stage-ratio.ts` exports `useStageRatio`. Never `Focusable.tsx`, never
`stageRatio.ts`.

`packages/ui` holds this without exception across 756 files. `packages/tv` has
drifted, with about a third of its files in PascalCase. The rule is the kit's,
not the kit's alone: name a new file kebab-case wherever it lands, and rename a
PascalCase neighbour only when you are already changing it.

Rust is snake_case, and always has been. No exceptions in the tree.

## The suffix vocabulary

A suffix is a resolution instruction, not decoration. These are the ones in use:

| Suffix | Means |
|---|---|
| `.test.ts` `.test.tsx` | A vitest suite, beside the file it covers |
| `.native.test.ts` | Must run under Metro resolution, where the plain file wins |
| `.web.ts` `.web.tsx` | The web implementation, chosen by the shells' Vite config |
| `.story.mdx` | The workbench story for a kit component |
| `.fixtures.tsx` | Rendered demo props for a story |
| `.fixture.ts` | Plain data a test or story imports |
| `.demo.tsx` | A standalone demo the workbench mounts |
| `.a11y.test.tsx` | An accessibility suite, kept separate so it can be run alone |
| `.gen.ts` | Generated. Never hand-edited, exempt from every policy |

Invent no new suffix. A file that does not fit one of these is a plain
`name.ts`.

## A component is a folder

Every kit component is a directory holding its code, its story, its demos and its
tests:

```
focusable/
  focusable.tsx
  focusable.test.tsx
  focusable.a11y.test.tsx
  focusable.lift.native.test.tsx
  focusable.fixtures.tsx
  focusable.story.mdx
  index.ts
```

The folder, the file and the export all carry the same name. An `index.ts`
re-exports and nothing else:

```ts
export * from './focusable';
```

Logic in an `index.ts` is logic nobody can find.

## Test files

A test file is the file under test plus `.test.ts`, in the same directory. Not a
parallel `__tests__` tree, not a `tests/` folder at the package root.

Add `.native` before `.test` when the suite must run under Metro resolution:
`focus-remote.native.test.ts`. The two vitest projects derive their globs from
each other, so the suffix is the only thing deciding which runs it.

On the Rust side, unit tests live in a `mod tests` beside the code, and API
integration tests are files named `it_*.rs` beside the handlers:
`server/src/api/it_accounts.rs`.

The name *inside* the test is a different rule, and it belongs to the
**typescript-tests** and **rust-tests** skills: the test name is a sentence about
behaviour, and the file name is about resolution.

## Symbols

- **Name things fully.** `remainingRetries`, not `n`, not `retriesLeft2`. Short
  names are fine only for a short life: `i`, `f`, `ok` inside a five-line block.
- **A name that says nothing is always wrong.** `utils`, `helpers`, `common`,
  `misc`, `data`, `stuff`, `manager`, `handler` with no noun. A file named after
  nothing collects everything.
- **Never version a name.** `handleClickV2`, `parseEnhanced`, `dataNew`,
  `configFinal`. Name what it does, or replace the old one. Git holds the
  previous version.
- **A boolean reads as a claim**: `isVisible`, `hasAudio`, `canSeek`. Not
  `visible` on a function, not `flag`.
- **Units and scale belong in the name.** `expiresAtMs`, `widthPx`,
  `bitrateKbps`. A number whose unit is a comment is a bug waiting.
- **A hook starts with `use`**, and nothing else does. A property named `use`
  reached through an object gets treated as a hook by the React Compiler, which
  memoizes and freezes it.
- **English, always.** Code, comments, identifiers and commit messages. French is
  for user-facing copy, which is content and lives behind a translation key.

## Directories

Feature slices use the domain nouns the rest of the repo uses, the same words
that name the server's crates, the spec's spaces and the `area/` labels:
`catalog`, `playback`, `accounts`, `admin`, `discovery`, `modules`, `library`,
`media`. Learn the vocabulary once and use it everywhere. A new noun for an
existing domain is how two names for one thing start.

Module ids are reverse-DNS: `tv.kroma.torrents`.
