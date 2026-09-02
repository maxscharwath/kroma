import { fileURLToPath } from 'node:url';
import { collectBuildInfo } from '@kroma/build-info';
import { kroma } from '@kroma/bundler';
import { gitHistory } from '@kroma/bundler/git-history';
import { propDocs } from '@kroma/bundler/props-docs';
import { RNW_DEFINE, rnwOptimizeDeps, webResolve } from '@kroma/bundler/rnw';
import { storyCode } from '@kroma/bundler/story-code';
import { kromaIconCatalog } from '@kroma/ui/vite/icon-catalog';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const kitDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  define: { __KROMA_BUILD__: JSON.stringify(collectBuildInfo(kitDir)), ...RNW_DEFINE },
  plugins: [
    kroma({ mdx: true }),
    kromaIconCatalog(),
    react(),
    propDocs({ tsconfig: `${repoRoot}packages/ui/tsconfig.json` }),
    storyCode({ tsconfig: `${repoRoot}packages/ui/tsconfig.json`, repo: repoRoot }),
    gitHistory({ repo: repoRoot, root: 'packages/ui/src' }),
    {
      name: 'kroma:watch-ui-stories',
      configureServer(server) {
        server.watcher.add(`${repoRoot}packages/ui/src`);
      },
    },
  ],
  resolve: webResolve(),
  base: '/',
  server: {
    port: 5180,
    fs: { allow: [repoRoot] },
  },
  optimizeDeps: rnwOptimizeDeps(),
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
  },
});
