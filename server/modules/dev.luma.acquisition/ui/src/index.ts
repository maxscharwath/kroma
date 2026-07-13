import { defineModule } from '@luma/module-sdk';
import { lazy } from 'react';
import manifest from '../../module.json';

// The Acquisition module (frontend half). Contributes the acquisition settings
// page into the Acquisition sidebar group. It is a settings-view module (the
// backend is the shared settings endpoint), so disabling it hides the nav + page.
export const acquisitionModule = defineModule(manifest, {
  locales: import.meta.glob<Record<string, string>>('../../locales/*.json', {
    eager: true,
    import: 'default',
  }),
  pages: [
    {
      path: 'acquisition',
      component: lazy(() => import('./AcquisitionPage')),
      nav: {
        label: 'nav.acquisition',
        icon: 'magnet',
        section: 'acquisition',
        requires: 'settings.manage',
      },
    },
  ],
});
