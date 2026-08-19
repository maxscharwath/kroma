# Project skills

Skills and agents this repository ships to any Claude Code session opened in it.
They are checked in so a clone gets them, and so a change to one is reviewed like
any other change.

| Component | Where | What it does |
|-----------|-------|--------------|
| `unslop` | `skills/unslop` | Cuts AI tells from prose before it ships: puffery, "not just X but Y", em dashes, rule of three, chatbot filler. Applies to docs, commit messages, PR descriptions and copy. |
| `typescript-best-practices` | `skills/typescript-best-practices` | Discriminated unions, branded types, `unknown` over `any`, no `as`, exhaustiveness, strict compiler options, errors as values, no floating promises. Examples in `references/patterns.md`. |
| `rust-best-practices` | `skills/rust-best-practices` | The same table one language over: enums with data, newtypes, errors by layer, borrow in and own out, nothing blocking the async runtime, `SAFETY:` on every unsafe. |
| `no-comments` | `skills/no-comments` | Runs the comment hunter over a diff and acts on what it finds. Slash-only, it never fires on its own. |
| `comment-hunter` | `../agents/comment-hunter.md` | The agent behind it. Hunts comments that narrate code, spares the few that carry a reason, edits comment lines only. |

`no-comments` and `comment-hunter` exist because the rule they enforce is the one
this repo breaks most often. See `CODE_STYLE.md` and `.claude/CLAUDE.md`.

## Origin

`unslop`, `typescript-best-practices`, `no-comments` and `comment-hunter` are
derived from the [pstack plugin](https://github.com/cursor/plugins/tree/main/pstack)
by Lauren Tan, used under the MIT licence:

> Copyright (c) 2026 Lauren Tan. Permission is hereby granted, free of charge, to
> any person obtaining a copy of this software and associated documentation files
> to deal in the Software without restriction, subject to the above copyright
> notice and this permission notice being included in all copies or substantial
> portions of the Software. The Software is provided "as is", without warranty of
> any kind. Full text:
> [cursor/plugins/pstack/LICENSE](https://github.com/cursor/plugins/blob/main/pstack/LICENSE).

They are edited, not vendored: the agent is renamed from `comment-sicko` and
rewritten in this repo's voice, and every reference to a skill pstack ships and
this repository does not (`/architect`, `/how`, `/why`, the `principle-*` set) is
replaced by the plain instruction it stood for, so nothing here points at
something that is not in the tree. `rust-best-practices` is new.

Upstream changes are not pulled automatically. To take one, read the diff and
port it by hand.
