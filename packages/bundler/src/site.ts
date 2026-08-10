import { fileURLToPath } from 'node:url';
import { type KitSheetOptions, kitSheet } from '@kroma/bundler/kit-sheet';
import { messageSubset } from '@kroma/bundler/message-subset';
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
  /** Ship the whole application catalog rather than the messages this site's own
   *  source and the design system name — for a site that builds a key at runtime. */
  appMessages?: boolean;
  /** Where the build starts crawling to compile the kit's stylesheet, and what
   *  the worker is handed while it renders. */
  sheet?: KitSheetOptions;
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
      ...(options.appMessages ? [] : [messageSubset({ roots: [`${root}src`] })]),
      kromaUI(),
      tanstackStart(options.prerender ? { prerender: { enabled: true, crawlLinks: true } } : {}),
      react(),
      kitSheet(options.sheet),
      ...(options.plugins ?? []),
    ],
    define: RNW_DEFINE,
    resolve: webResolve({ '#site': `${root}src`, ...options.alias }),
    // The kit ships raw TypeScript, and the aliases above land two transitive
    // deps on ESM builds Node cannot resolve on its own.
    ssr: { noExternal: ['@kroma/ui', '@kroma/core', ...RNW_SSR_NO_EXTERNAL] },
  };
}
