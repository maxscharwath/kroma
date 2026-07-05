import { defineConfig } from 'vite';
import { tvShellConfig } from '../tv-build/shell';
import { target } from './tv.target';

// The shared TV-shell pipeline, parameterized by ./tv.target.ts. This is the
// MODERN tier; the legacy tier (vite.config.legacy.ts) runs after it in `build`.
export default defineConfig(tvShellConfig(import.meta.url, target));
