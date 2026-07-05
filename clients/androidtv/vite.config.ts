import { defineConfig } from 'vite';
import { tvShellConfig } from '../tv-build/shell';
import { target } from './tv.target';

// The shared TV-shell pipeline, parameterized by ./tv.target.ts. The built
// dist/ is copied into the Android project's assets by `bun run sync:android`.
export default defineConfig(tvShellConfig(import.meta.url, target));
