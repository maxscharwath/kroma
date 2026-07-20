// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kroma.tv',
  // Static output served by the kroma-website Cloudflare worker (see wrangler.jsonc).
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
