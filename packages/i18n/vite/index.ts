import type { Plugin } from 'vite';

const PROVIDER = /[\\/]i18n[\\/]src[\\/]react[\\/]provider\.tsx$/;

const INJECTED = `
import { mount as __kromaI18nDevtools } from '@kroma/i18n/devtools';
const __kromaI18nDevtoolsStop = __kromaI18nDevtools();
if (import.meta.hot) import.meta.hot.dispose(__kromaI18nDevtoolsStop);
`;

/** The i18n dev tools, for a shell's `plugins`. Dev server only. */
export function kromaI18nDevtools(): Plugin {
  return {
    name: 'kroma-i18n-devtools',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id, options) {
      if (options?.ssr) return null;
      const query = id.indexOf('?');
      if (!PROVIDER.test(query === -1 ? id : id.slice(0, query))) return null;
      return { code: code + INJECTED, map: null };
    },
  };
}
