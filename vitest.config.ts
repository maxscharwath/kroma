import { defineConfig } from 'vitest/config';

// Pure-logic unit tests: the shared core (engine selection, audio-track
// resolution, master-variant + URL builders) and the TV engine's native AVPlay
// audio mapping. These run in the `node` environment (no DOM). Test files must
// use relative imports (no `#tv`/`#web` path aliases).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'clients/web/src/**/*.test.ts'],
    // Inline zod so Vite resolves it (via the `import` condition -> built
    // index.js) instead of Bun externalizing it and matching zod's `@zod/source`
    // condition -> raw TS source, whose `z` export is undefined under the runner.
    server: { deps: { inline: ['zod'] } },
    coverage: {
      // istanbul (source-instrumented) works under Bun's runtime; the v8
      // provider needs node:inspector coverage APIs Bun doesn't implement.
      // Emits lcov for SonarCloud (coverage/lcov.info) + a text summary in CI.
      // Scope/exclusions live in sonar-project.properties.
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
