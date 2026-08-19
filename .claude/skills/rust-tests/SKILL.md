---
name: rust-tests
description: Write cargo tests for the server crates and the modules. A test name is a sentence, the body is setup, mock, test and verify blocks separated by blank lines with no comments, and shared setup lives in test_support rather than in each test. Covers naming, the block shape, where a test file goes, integration tests beside the handlers, async and time, and running one crate or one filter. Use when adding or changing any #[test] or #[tokio::test], or when Rust coverage has to come up. Triggers - "write a rust test", "cargo test", "test this crate", "cover this handler".
---

# Rust tests

Same three rules as the TypeScript side: **the name is the sentence**, **the body
is blocks separated by blank lines**, and **there are no comments**. The
differences are where a test lives and what setup it is allowed to do.

```rust
#[test]
fn refuses_to_scan_without_tmdb() {
    let state = test_state();
    let progress = Progress::default();

    let err = scan(&state, &progress.record(), &never_cancelled()).unwrap_err();

    assert!(matches!(err, ScanError::NoTmdbKey));
    assert_eq!(progress.seen(), vec![]);
}
```

## The four blocks

A body is up to four blocks, always in this order, one blank line between them:

| Block | Holds |
|-------|-------|
| **setup** | Fixtures, state, the world the behaviour needs |
| **mock** | Fakes and the responses they are primed with |
| **test** | The one call under test |
| **verify** | The assertions |

- **A blank line only ever separates two blocks.** Never one inside a block,
  never two in a row.
- **An empty block is absent, not blank.** Most tests here have three, because
  `test_support` builds the world and there is nothing left to fake.
- **No comment names a block.** The order is the label.
- **Every assertion in verify.** An `assert!` in the setup block is a
  precondition, and one worth checking is its own test.
- `let` bindings that only feed the call belong in setup, not squeezed into the
  test line. One statement under test, readable on its own.

Rust makes the mock block rarer than TypeScript does: a trait with a small fake
implementation is setup, not mocking, and it lives above the tests with a name.

## Naming

The function name is the sentence, in the present tense, describing behaviour:

```rust
fn refuses_to_scan_without_tmdb()          // good
fn marks_a_missing_file_absent()           // good

fn test_scan()                             // names the function under test
fn scan_works()                            // says nothing
fn test_scan_returns_err_when_key_is_none() // describes the code, not the rule
```

Drop the `test_` prefix. `#[test]` already says it.

## Size and setup

One situation, one action, one assertion. Shared setup belongs in
`test_support`, not repeated in each test:

```rust
use crate::test_support::{seed_show_episode, test_state, test_state_with_tmdb};
```

When a test needs a fake collaborator, give it a name and keep it above the
tests, not inline:

```rust
#[derive(Default)]
struct Progress(RefCell<Vec<(usize, usize)>>);
```

A test that runs long is two tests, or a fixture that wants a name, or a function
that needs too many collaborators to say anything.

## No comments

No banner, no note above a case, no paragraph explaining what the module pins.
The name carries the behaviour and the blank lines carry the phases. A comment survives only for a genuinely non-obvious fixture
value, stating why that value and not another.

`// SAFETY:` still applies inside `unsafe`, in tests as everywhere else.

## Assert behaviour

- `assert!(matches!(err, ScanError::NoTmdbKey))` beats asserting on a formatted
  string: the message is prose and prose changes.
- Assert the observable result, not the number of times a collaborator was
  called, unless the count is the behaviour.
- `unwrap()` and `expect()` are fine in a test. A panic is a failure and that is
  the point.
- Never weaken an assertion to make a suite green.

## Where it goes

- **Unit tests** live beside the code in `mod tests`, `#[cfg(test)]`.
- **Integration tests for the API** live beside the handlers as
  `src/api/it_*.rs`, not in a top-level `tests/`.
- **A module** is its own cargo workspace, so its tests run from
  `modules/<id>/server` and are reached by `bun run modules:test`, never by
  `--workspace` from `server/`.

## Async and time

- `#[tokio::test]` for anything awaiting. Keep the runtime default unless the
  test needs otherwise.
- Never `sleep` to synchronise. Wait on the thing itself: a channel, a notify, a
  join handle. A sleep is a flake with a timer on it.
- Pass time in rather than reading the clock, so the test does not depend on when
  it runs.

## Running one

```bash
cd server && cargo test -p kroma-scene
cd server && cargo test --workspace parse_episode
cd modules/tv.kroma.torrents/server && cargo test
```

Coverage for the Rust side lands in `server/lcov.info` and is read by
`sonar-loop`.

## Before the PR

```bash
cd server && cargo clippy --workspace --all-targets && cargo test --workspace
bun run modules:clippy && bun run modules:test
```

The second line is not redundant: modules are separate cargo workspaces, so
`--workspace` from `server/` does not reach them.
