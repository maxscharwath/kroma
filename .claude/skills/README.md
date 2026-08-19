# Project skills

Skills and agents this repository ships to any Claude Code session opened in it.
They are checked in so a clone gets them, and so a change to one is reviewed like
any other change.

| Component | Where | What it does |
|-----------|-------|--------------|
| `unslop` | `skills/unslop` | Cuts AI tells from prose before it ships: puffery, "not just X but Y", em dashes, rule of three, chatbot filler. Applies to docs, commit messages, PR descriptions and copy. |
| `typescript-best-practices` | `skills/typescript-best-practices` | Discriminated unions, branded types, `unknown` over `any`, no `as`, exhaustiveness, strict compiler options, errors as values, no floating promises. Examples in `references/patterns.md`. |
| `rust-best-practices` | `skills/rust-best-practices` | The same table one language over: enums with data, newtypes, errors by layer, borrow in and own out, nothing blocking the async runtime, `SAFETY:` on every unsafe. |
| `no-comments` | `skills/no-comments` | Runs the comment sicko over a diff and acts on what it finds. Slash-only, it never fires on its own. |
| `comment-sicko` | `../agents/comment-sicko.md` | The agent behind it. Hunts comments that narrate code, spares the few that carry a reason, edits comment lines only. |

`no-comments` and `comment-sicko` exist because the rule they enforce is the one
this repo breaks most often. See `CODE_STYLE.md` and `.claude/CLAUDE.md`.

## Origin

`unslop`, `typescript-best-practices`, `no-comments` and `comment-sicko` are
derived from the [pstack plugin](https://github.com/cursor/plugins/tree/main/pstack)
by Lauren Tan, MIT licensed, see [`LICENSE-pstack`](LICENSE-pstack).

They are edited, not vendored. Every reference to a skill pstack ships and this
repository does not (`/architect`, `/how`, `/why`, the `principle-*` set) is
replaced by the plain instruction it stood for, so nothing here points at
something that is not in the tree. `rust-best-practices` is new.

Upstream changes are not pulled automatically. To take one, read the diff and
port it by hand.
