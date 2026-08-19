# Project skills

Skills and agents this repository ships to any Claude Code session opened in it.
They are checked in so a clone gets them, and so a change to one is reviewed like
any other change.

## Writing

| Skill | What it does |
|-------|--------------|
| `unslop` | Cuts AI tells from prose before it ships: puffery, "not just X but Y", em dashes, rule of three, chatbot filler. For docs, commit messages, PR descriptions and copy. |
| `spec-writing` | Writes and changes `docs/spec`: what belongs there rather than in architecture, the status vocabulary, requirement IDs and keeping them stable, sizing one so it becomes one story. |
| `ticket-writing` | Issues and PR descriptions: the epic and sub-issue structure, linking a requirement ID instead of copying spec text, the label axes, what a reviewer needs. |

## Code

| Skill | What it does |
|-------|--------------|
| `file-structure` | One file, one job: the size policy, what a natural seam is, where a split lands, and the signals a file is already two files. |
| `naming` | Kebab-case files named after their export, the suffix vocabulary, a component folder's layout, snake_case and `it_` on the Rust side, and the names that are always wrong. |
| `typescript-best-practices` | Discriminated unions, branded types, `unknown` over `any`, no `as`, exhaustiveness, strict compiler options, errors as values, no floating promises. Examples in `references/patterns.md`. |
| `rust-best-practices` | The same table one language over: enums with data, newtypes, errors by layer, borrow in and own out, nothing blocking the async runtime, `SAFETY:` on every unsafe. |
| `no-comments` | Runs the comment hunter over a diff and acts on what it finds. Slash-only, it never fires on its own. |

## Tests and the gate

| Skill | What it does |
|-------|--------------|
| `tdd` | The failing test before the code, for new behaviour and for bugs, and when to skip the loop honestly rather than force a bad test. |
| `typescript-tests` | Vitest in this repo: the name is a sentence, the body is setup, mock, test and verify blocks separated by blank lines, no comments, and the two resolution projects decide where the file goes. |
| `rust-tests` | Cargo tests: the same block shape, sentence names, setup in `test_support`, integration tests beside the handlers, no `sleep` for synchronisation. |
| `sonar-loop` | Drives a PR to 0 issues, 0% duplication and near-total coverage on new logic, then watches the checks until every one passes. |

## Agents

| Agent | What it does |
|-------|--------------|
| [`comment-hunter`](../agents/comment-hunter.md) | Hunts comments that narrate code, spares the few that carry a reason, edits comment lines only. |
| [`spec-reviewer`](../agents/spec-reviewer.md) | Reviews `docs/spec` for readability, status and ID nomenclature, architecture leakage, and whether a requirement is atomic enough to become work. |

`no-comments` and `comment-hunter` exist because the rule they enforce is the one
this repo breaks most often. See `CODE_STYLE.md` and `.claude/CLAUDE.md`.

## What is also installed globally

Four of these are portable, so they also live in `~/.claude/skills` and load in
every project on this machine: `unslop`, `typescript-best-practices`,
`rust-best-practices` and `tdd`. They name no path, script or threshold that only
exists here, and the copies are identical to these, so edit one and copy it
across rather than letting the two drift.

The other eight are about this repo. They cite `docs/spec`, this repo's labels,
`bun run sonar:precheck`, `@kroma/*` package names, `test_support` and the
300-line policy, so they stay here and travel with a clone.

The `comment-hunter` agent is portable and is installed globally too.

## Editing one

A skill is prose an agent reads, so the bar is the same as any other doc here: no
em dashes, no comments narrating the work, and no reference to a skill or agent
that is not in this tree. Check a change before committing it:

```bash
claude plugin validate .claude/skills --strict
claude plugin validate .claude/agents --strict
```
