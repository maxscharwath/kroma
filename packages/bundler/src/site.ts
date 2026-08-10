import { fileURLToPath } from 'node:url';
import { RNW_DEFINE, RNW_SSR_NO_EXTERNAL, webResolve } from '@kroma/bundler/rnw';
import { kromaUI } from '@kroma/ui/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, UserConfig } from 'vite';

export interface KromaSiteOptions {
  /** Extra `resolve.alias` entries, on top of `#site` and the react-native-web set. */
  alias?: Record<string, string>;
  plugins?: Plugin[];
  /** Prerender every page reachable from the entry links instead of rendering per request. */
  prerender?: boolean;
}

/**
 * The Vite config every KROMA web property shares: the design system, TanStack
 * Start and the react-native-web resolution the kit needs to render on a
 * server.
 *
 *   export default kromaSite(import.meta.url)
 */
export function kromaSite(siteUrl: string, options: KromaSiteOptions = {}): UserConfig {
  const root = fileURLToPath(new URL('.', siteUrl));
  return {
    plugins: [
      kromaUI(),
      tanstackStart(options.prerender ? { prerender: { enabled: true, crawlLinks: true } } : {}),
      react(),
      ...(options.plugins ?? []),
    ],
    define: RNW_DEFINE,
    resolve: webResolve({ '#site': `${root}src`, ...options.alias }),
    // The kit ships raw TypeScript, and the aliases above land two transitive
    // deps on ESM builds Node cannot resolve on its own.
    ssr: { noExternal: ['@kroma/ui', '@kroma/core', ...RNW_SSR_NO_EXTERNAL] },
  };
}
