import { depsWithoutMaps } from '@kroma/bundler/deps-without-maps';
import { kromaMdx } from '@kroma/bundler/mdx';
import { kromaCatalogs } from '@kroma/core/vite';
import { kromaI18nDevtools } from '@kroma/i18n-devtools/vite';
import { type KromaUIOptions, kromaUI } from '@kroma/ui/vite';
import type { PluginOption } from 'vite';

export interface KromaOptions {
  /** `full` keeps every Tabler icon, for the kit's own gallery; the default
   *  ships the ones the source names. */
  icons?: KromaUIOptions['icons'];
  /** Compile the kit's `.docs.mdx`, for a shell that mounts the workbench. */
  mdx?: boolean;
}

/**
 * Everything a KROMA shell takes from the workspace, as one plugin entry: the
 * dev server's dependency maps stripped, the message catalogs found, typed and
 * bundled per screen, the design system's tokens, icons and fonts, and the
 * i18n dev tools. Put it before `react()`: the MDX it compiles has to be JSX
 * before the React transform sees it.
 */
export function kroma({ icons, mdx = false }: KromaOptions = {}): PluginOption[] {
  return [
    depsWithoutMaps(),
    kromaCatalogs(),
    kromaUI({ icons }),
    kromaI18nDevtools(),
    mdx ? kromaMdx() : [],
  ];
}
