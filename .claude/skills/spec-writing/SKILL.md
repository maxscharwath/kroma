---
name: spec-writing
description: Write and change files under docs/spec. Covers what belongs in the spec rather than in architecture, the status vocabulary, requirement IDs and how to keep them stable, and how to size a requirement so it becomes one story. Use when adding or editing a spec chapter, when a PR changes behaviour and the spec has to move with it, or when asked what the product should do. Triggers - "write the spec", "add a requirement", "spec this out", "update docs/spec", "what should this do".
---

# Writing the spec

Read [`docs/spec/README.md`](../../../docs/spec/README.md) first, every time. It is
the contract and it wins over anything here. The `spec-reviewer` agent checks the
result, so write for that review.

The spec says **what** the product does and **why**. Architecture says how the
code is shaped. The test: a sentence that survives a full rewrite of the
implementation belongs in the spec. A sentence naming a crate, a file, a
framework, a wire format or a schema does not.

## Before writing

Find the space. One folder per domain under `docs/spec/`, using the nouns
`ARCHITECTURE.md` already uses: `library`, `media`, `playback`, `accounts`,
`discovery`, `modules`, `admin`, `surfaces`. A new space needs a reason, not a
new noun for an existing domain.

Read the space's `README.md` and its sibling chapters before adding to them. Two
chapters that disagree on the same rule is the defect the reviewer flags hardest.

## Every section carries a status

`SHIPPED`, `AGREED`, `DRAFT`, or `DESIGN, NOT IMPLEMENTED`. A section without one
is a bug in the spec.

`DESIGN, NOT IMPLEMENTED` must say why it was deferred and what shipped instead.
That record is worth more than the design was.

## Requirement IDs

Every normative statement, anything a reader could implement or test, carries an
ID and its own status:

> **LIB-4** (AGREED) - A rescan never deletes user data. A file that disappears is
> marked absent; its watch history survives.

- One prefix per space, one space per prefix. Pick something legible and stay with it.
- `N` is assigned once. Never renumbered, never reused. A deleted requirement
  retires its number. Check `git log` before you believe a number is free.
- One ID is one testable idea. A line hiding two requirements needs two IDs.

Assign the next number by reading
[`docs/spec/requirements.json`](../../../docs/spec/requirements.json), not by
counting prose.

## Sizing

A requirement maps to one story; a domain maps to one epic. A requirement that is
really five stories wearing one ID is what makes a spec useless for planning.
Split it.

The other direction is also wrong: an ID on a sentence nobody could test is
noise. If you cannot say how a reader would prove it true, it is prose, not a
requirement, and it needs no ID.

## Prose

A tired reader on a phone follows it on the first read. Paragraphs under five
lines, one idea per sentence, no undefined jargon, no passive construction hiding
who acts. A spec that is correct and unreadable is a defect.

Run the **unslop** skill over anything before committing it, and the
**ticket-writing** skill when the requirement becomes work.

## Before the PR

```bash
bun run spec:index    # regenerate requirements.json and INDEX.md, then commit both
bun run spec:check    # fails on a stale index, duplicate ID, mixed prefix, missing status
```

Both artefacts are generated. Never hand-edit them.

The spec changes only through a pull request, and a PR that changes behaviour
changes the spec in the same PR. For anything large or contested, write an RFC in
`docs/rfcs/` first.
