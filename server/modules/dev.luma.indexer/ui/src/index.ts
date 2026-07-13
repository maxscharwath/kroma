import { defineModule } from '@luma/module-sdk';
import { lazy } from 'react';
import manifest from '../../module.json';

// The Indexers module (frontend half). id / version / dependsOn come from the
// shared module.json (same file the backend reads). It contributes the full
// Indexers admin page into the Acquisition sidebar group; the paired
// IndexersModule ServerModule gates the /api/admin/indexers routes, so disabling
// the module removes the page and its routes together.
export const indexerModule = defineModule(manifest, {
  locales: import.meta.glob<Record<string, string>>('../../locales/*.json', {
    eager: true,
    import: 'default',
  }),
  pages: [
    {
      path: 'indexers',
      component: lazy(() => import('./IndexersPage')),
      nav: {
        label: 'nav.indexers',
        icon: 'antenna',
        section: 'acquisition',
        requires: 'settings.manage',
      },
    },
  ],
});
