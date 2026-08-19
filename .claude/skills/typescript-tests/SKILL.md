---
name: typescript-tests
description: Write vitest tests for this repo. A test name is a sentence, the body is setup, mock, test and verify blocks separated by blank lines with no comments, and the two module-resolution projects decide where the file goes. Covers naming, the block shape, size, fixtures, what not to assert, jsdom opt-in, native resolution, and running one test. Use when adding or changing any .test.ts or .test.tsx, or when coverage has to come up. Triggers - "write a test", "add tests", "test this", "vitest", "how do I test", "cover this file".
---

# TypeScript tests

A test earns its place by being read, not by existing. Three rules carry most of
it: **the name is the sentence**, **the body is blocks separated by blank lines**,
and **there are no comments**.

```ts
it('falls back to the handed shape when the stage measures zero', () => {
  const node = stage('stage-b', 0, 0);

  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0 } as DOMRect);

  const { result } = renderHook(() => useStageRatio('stage-b', 4 / 3));

  expect(result.current).toBeCloseTo(4 / 3, 6);
});
```

The name says what is guaranteed and the blank lines say where each phase ends,
so nothing is left for a comment to say.

## Naming

The name completes "it ...", describes the behaviour, and never mentions the
implementation.

```ts
it('rejects a range past EOF', ...)                 // good
it('marks a file absent rather than deleting it', ...)  // good

it('should work', ...)                              // says nothing
it('test parseRange', ...)                          // names the function, not the behaviour
it('returns false when the second argument is undefined', ...)  // describes the code
```

If you cannot name it in a sentence, the test is doing two things. Split it.

## The four blocks

A body is up to four blocks, always in this order, one blank line between them:

| Block | Holds |
|-------|-------|
| **setup** | Fixtures, state, the world the behaviour needs |
| **mock** | Stubs, spies, fakes, and what they are told to return |
| **test** | The one action under test |
| **verify** | The assertions |

Rules that keep the shape readable:

- **A blank line only ever separates two blocks.** Never one inside a block, and
  never two in a row. A stray blank line reads as a phase boundary that is not
  there.
- **An empty block is absent, not blank.** A test with nothing to mock has three
  blocks. A one-line setup and a one-line assertion is two.
- **No comment names a block.** `// Arrange`, `// Act`, `// Assert`, `// setup`
  and `// given` are all the blank line written twice. The order is the label.
- **One action in the test block.** Two calls under test means two tests, unless
  the second is the only way to observe the first.
- **Every assertion in verify.** An `expect` sitting in the setup block is a
  precondition check, and a precondition worth checking is its own test.

```ts
it('marks a file absent rather than deleting its history', async () => {
  const library = await seedLibrary({ files: ['a.mkv'] });
  await library.watch('a.mkv', { seconds: 640 });

  vi.spyOn(fs, 'stat').mockRejectedValue(new Error('ENOENT'));

  await rescan(library);

  expect(library.get('a.mkv')).toMatchObject({ absent: true });
  expect(library.progress('a.mkv')).toEqual({ seconds: 640 });
});
```

Two assertions, because "marks absent" and "history survives" are one behaviour
seen from two sides. Three unrelated assertions would be three tests.

## Size

A test that runs past roughly fifteen lines is usually one of three things:

- Two tests sharing a body. Split them.
- A fixture that wants extracting into a named helper above the `describe`.
- Production code that needs three collaborators to say anything, which is a
  design signal, not a testing problem.

Keep the helper small and name it after what it builds:

```ts
function stage(id: string, width: number, height: number): HTMLElement {
  const node = document.createElement('div');
  node.id = id;
  node.getBoundingClientRect = () => ({ width, height }) as DOMRect;
  document.body.append(node);
  NODES.push(node);
  return node;
}
```

## No comments

The rule holds hardest here, because a test comment is nearly always the name
saying it should have been rewritten, or a block label the blank line already
gave. No file header explaining what the suite pins, no note above a case, no
rationale paragraph.

The one comment that survives is a genuinely non-obvious fixture value: why *this*
byte, why *this* timestamp. One line, stating the reason, not the value.

## Assert behaviour, not shape

- Assert what a caller would notice. A snapshot of an internal structure fails on
  every refactor and catches nothing.
- Never assert a mock was called when you can assert what the call produced.
- A test that still passes with the implementation deleted tests nothing. Check
  by deleting it, briefly, when you are unsure.
- Do not weaken an assertion to make a suite green. Either the behaviour changed,
  and the name changes with it, or there is a bug.

## Where the file goes

There are two vitest projects because there are two module-resolution universes:

- **web**: `.web.*` files win, mirroring the shells' Vite config. This is the default.
- **native**: Metro precedence, the plain file wins. A test that must run under
  it is named `*.native.test.ts`.

The include globs are derived from the web list, so the two cannot drift. Put the
test beside the code it covers.

The default environment is `node`. A test needing a DOM opts in on the first line:

```ts
// @vitest-environment jsdom
```

## Running one

```bash
bun run test packages/core/src/hevc.test.ts
bun run test --project web -t 'rejects a range'
bun run test:coverage
```

## Coverage

Write the test where it reaches the logic. If the logic sits somewhere no test
can call, move the logic rather than excluding the file. `**/*.tsx` is
coverage-excluded, so behaviour worth pinning belongs in a `.ts` a test can
import. A re-export barrel emits no statements and neither helps nor hurts.

Vitest's percentage counts only the files it loaded, while Sonar counts every file
in scope at 0%. Trust `sonar-loop` for the real number.

Where the file goes on disk, and what its suffix means, belong to the **naming**
skill.
