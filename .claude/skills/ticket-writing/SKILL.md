---
name: ticket-writing
description: Write GitHub issues and PR descriptions for this repo. Covers the epic and sub-issue structure, linking a requirement ID instead of copying spec text, the label set, title format, and what a reviewer needs in a PR body. Use when opening an issue, turning a spec requirement into work, filing a bug, or writing a PR description. Triggers - "open an issue", "write a ticket", "file a bug", "turn this into work", "write the PR description".
---

# Writing tickets

An issue says what is left to do. The spec says what should be true. Keeping
those apart is the whole job.

## Never copy spec text

Link the requirement, do not restate it. Copies rot, and the moment they disagree
nobody knows which one is the product.

```
Implements: LIB-4, LIB-7
```

Resolve an ID to its chapter and line through
[`docs/spec/requirements.json`](../../../docs/spec/requirements.json). If the
behaviour has no requirement yet, the spec change comes first: use the
**spec-writing** skill, then open the issue against the new ID.

## Structure

Each domain has one long-lived **epic** issue. Implementation work is opened as a
**sub-issue** of that epic, so the board rolls up without anyone maintaining a
checklist by hand.

A sub-issue is one story: one requirement ID, one reviewable change, one PR. Work
that needs three PRs is three sub-issues.

## Templates

Blank issues are disabled. Pick the form that fits:

| Template | For |
|---|---|
| `bug_report.yml` | Something is broken, with a reporter and a reproduction |
| `feature_request.yml` | New capability |
| `task.yml` | Internal work: refactor, chore, docs, CI, performance |

Title is `<surface>: <imperative summary>`, lower case, no trailing full stop.
`ci: cache cargo builds between release jobs` reads right. `Fix the CI` does not.

Labels come in two axes, and a ticket takes one of each: `type/*` (bug, feature,
docs, perf, refactor, chore, question, security) and `area/*` (server, web, tv,
mobile, desktop, modules, sdk). The `area/` label matches the spec space the work
belongs to.

## What a good ticket carries

- **What needs doing**, in the reader's terms, not the implementation's.
- **Why now.** What it unblocks, or what it costs to keep not doing it. "It
  bothers me" is a real reason, written down.
- **Done when.** The observable condition. If you cannot name one, the ticket is
  not ready and probably wants `type/question` instead.

Leave the design out unless it is the point. A ticket that dictates the patch
removes the reason to have an engineer read it.

## Security

Never open a public issue for a vulnerability. It goes through a private security
advisory, see `SECURITY.md`.

## PR descriptions

The template asks four things, and each has a real answer:

- **What**: one paragraph, what changes and why this way rather than another.
- **Closes**: `Closes #123`, or "no issue" and a sentence on why it did not need one.
- **Checks**: the boxes are claims. Tick one only after running it.
- **Risk**: what breaks if this is wrong, and how a reviewer would notice. "None,
  it is a docs typo" is a fine answer.

Title is the commit title, conventional commits, and the PR is squash-merged so
that title becomes the commit on `main`.

Run the **unslop** skill over the body before opening. A PR description is the
most-read prose in the repo and the most likely to arrive padded.
