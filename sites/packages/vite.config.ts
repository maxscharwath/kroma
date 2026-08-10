import { fileURLToPath } from 'node:url';
import { RNW_DEFINE, RNW_SSR_NO_EXTERNAL, webResolve } from '@kroma/bundler/rnw';
import { kromaUI } from '@kroma/ui/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [kromaUI(), tailwindcss(), tanstackStart(), react()],
  define: RNW_DEFINE,
  resolve: webResolve({
    '#pkg': fileURLToPath(new URL('./src', import.meta.url)),
  }),
  ssr: {
    noExternal: ['@kroma/ui', ...RNW_SSR_NO_EXTERNAL],
  },
});
