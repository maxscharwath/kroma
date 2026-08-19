---
name: sonar-loop
description: Drive a PR to a green quality gate and keep it there. Loops on SonarCloud for this repo's targets, 0 new issues, 0% duplication on new code, and coverage on new logic as close to 100% as the code allows, then watches the PR checks until every one passes. Use when a quality gate blocks a merge, when coverage or duplication has to come up, or before asking for review. Triggers - "fix the sonar issues", "quality gate", "get coverage up", "zero duplication", "loop until CI is green", "watch the checks".
---

# Sonar loop

`CONVENTIONS.md` states the target and it is not negotiable per PR: **0 Sonar
issues, 0% duplication on new code, and near-total coverage on new logic**. Not
later, not in a follow-up. The gate is part of done.

Read [`sonar-project.properties`](../../../sonar-project.properties) before
deciding anything is a false positive. It holds the scanner's scope, the coverage
denominator, and every reviewed suppression.

## Run the gate locally first

Cheaper than a round trip through CI, and it catches most of it:

```bash
bun run sonar:precheck    # the changed files, against the rules that usually fire
bun run sonar:lint        # sonar-project.properties itself stays valid
bun run check             # biome format + lint
bun run test:coverage     # lcov for the TS side
```

Rust coverage lands in `server/lcov.info`, TypeScript in `coverage/lcov.info`.

## The loop

1. Read the current state. Measures first, so you fix the thing that is actually
   failing:

```bash
PR=118
SONAR_PROJECT=$(grep sonar.projectKey sonar-project.properties | cut -d= -f2 | tr -d ' ')
curl -fsSL -u "${SONAR_TOKEN}:" \
  "https://sonarcloud.io/api/measures/component?component=${SONAR_PROJECT}&pullRequest=${PR}&metricKeys=new_violations,new_coverage,new_duplicated_lines_density,new_security_hotspots" \
  | jq -r '.component.measures[] | "\(.metric)=\(.period.value // .value)"'
```

   The quality-gate endpoint carries numbers the measures endpoint returns as
   null, so fall back to
   `/api/qualitygates/project_status?pullRequest=${PR}&projectKey=${SONAR_PROJECT}`
   when a value is missing.

2. Take the offenders one at a time, worst first. One cause per commit.
3. Push, then wait for the rescan rather than guessing:

```bash
gh pr checks $PR --watch --fail-fast
```

4. Re-read the measures. The check set can change between runs, so re-read it
   rather than assuming the previous list still holds.
5. Stop when all three targets are met and every check is green.

## Fixing, in order of preference

**Coverage.** Untested new logic is the usual gap, and the usual cause is logic
that landed somewhere a test cannot reach. Move it rather than excluding it: new
logic goes where a test can call it. Use the **typescript-tests** and
**rust-tests** skills to write the test, and **tdd** when the code is not written
yet.

Two traps specific to this repo. Vitest's percentage only counts files it loaded,
while Sonar counts every file in scope, so a file no test imports reads as 0% to
Sonar and is invisible locally. And a `require()` or an `import.meta.env.VITE_*`
branch is unreachable under the runner, so a test that covers it passes
vacuously.

**Duplication.** Extract the shared thing into a real home and have both callers
reach it by name. Copying a block and renaming a variable is what put it there.

**Issues.** Prefer a code fix over a suppression, every time. When a rule is
genuinely wrong for a line, the entry goes in `sonar-project.properties` where a
reviewer sees it, with the reason. Never `// NOSONAR`.

## Failures that are not yours

If a check fails for a reason the PR did not cause and `main` is green, merge
latest `main` rather than bloating the PR with an unrelated fix. If a check is
flaky, retry once and say so with the evidence. Never `--no-verify`.

## Report

Current numbers against the three targets, what was fixed and why, anything
suppressed and the reason, and the PR URL once it is green.
