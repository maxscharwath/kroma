---
name: file-structure
description: One file, one job, and short enough to hold in your head. Covers the size policy (hard-split over 300 lines, split 200 to 300 at a seam, aim for 150), what a natural seam is and where to cut, the exemptions, the dependency rules that decide where the split lands, and the signals that a file is already two files. Use before adding to a file that is already long, when naming a new file, when a function has nowhere obvious to live, or when a review says a file is doing too much. Triggers - "this file is too long", "where should this go", "split this file", "is this file too big", "one responsibility".
---

# File structure

Two rules, and the second is a symptom of the first.

**One file, one responsibility, and its name says which.** A file you cannot name
without "and" is two files.

**Short enough to hold in your head.** Hard-split over **300 lines**. Split
**200 to 300** only where a seam already runs. Aim for **150**.

Exempt, because splitting them makes them worse: `generated/`, `*.gen.ts`,
vendored code, data and locale JSON, lockfiles, and irreducible adapters such as
an ffmpeg flag builder.

## The cut is a seam, not a line count

Never split at line 300 to satisfy the number. Cut where a domain or layer
boundary already runs through the file, and if there is no such boundary the file
may be long because the job is.

Finding the seam, in the order that usually works:

1. **Name the file's job in one sentence.** The word after "and" is the seam.
2. **Group by what changes together.** Two clusters that never change in the same
   commit are two files, whatever their line count.
3. **Follow the imports.** A block that pulls in a whole subsystem nothing else in
   the file touches wants to leave with it.
4. **Look for the noun.** A cluster of functions all taking and returning the same
   type is that type's module.

A cut that leaves two files importing each other's internals was not a seam. Put
it back and look again.

## Where the piece lands

Splitting is only half the decision. The other half is which side of a boundary
the new file sits on, and the boundaries here are not suggestions.

- **Frontend slices.** `clients/web/src` and `packages/tv/src` are feature-sliced.
  The dependency rule runs one way: `features/* -> shared/* -> @kroma/ui ->
  @kroma/core`. A feature must never import a sibling feature. Code two features
  both need moves up to `shared/`, not sideways.
- **Packages by name.** `import { tvShellConfig } from '@kroma/bundler'`, never a
  relative path out of the package. If the shared code has no package, giving it
  one is the work.
- **Server layers are crates**, so the inward-only rule is enforced by the
  compiler. A helper that belongs to the domain goes in `kroma-domain`, which
  means it may not reach for axum or rusqlite. `api/` holds no business logic.
- **The kit has six levels**: tokens, atoms, molecules, organisms, templates. A
  component knows only the levels below it. Pages are not in the kit.
- **A module is its own workspace.** Shared module code goes through the SDK, and
  no host-side crate may name a specific module.

## Signals a file is already two files

- The name contains "and", or is a bag: `utils`, `helpers`, `common`, `misc`.
- Two `describe` blocks in its test that share no setup.
- A reader has to scroll past unrelated code to follow one path.
- Two exports whose callers never overlap.
- A change to one half keeps forcing a merge conflict with someone working on the
  other.
- Adding a feature means adding a parameter to something the feature does not own.

## Applies to what you touch

The policy governs the file you are changing, not the whole tree. Several files
here are well over the limit already, and a PR is not the place to discover that.
Leaving a file simpler than you found it is expected; rewriting an unrelated
1500-line service because you passed through it is a separate change with its own
review.

That said, a change that lands duplication, dead code, or a second way of doing
something the file already does is not finished. The refactor is part of the
change, not a follow-up.

## Checking

```bash
find packages clients server/src server/crates -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.rs' \) \
  | grep -vE 'node_modules|\.gen\.|/generated/|locales/' \
  | xargs wc -l | sort -rn | head -20

bun run deadcode
```

Nothing in CI enforces the line count, so it holds only where a reader insists on
it in review.
