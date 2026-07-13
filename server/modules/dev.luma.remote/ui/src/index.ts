import { defineModule } from '@luma/module-sdk';
import { lazy } from 'react';
import manifest from '../../module.json';

// The Remote access module (frontend half). Contributes the Remote access admin
// page into the System sidebar group; the paired RemoteModule ServerModule gates
// the /api/admin/remote routes, so disabling the module removes the page and its
// routes together.
export const remoteModule = defineModule(manifest, {
  locales: import.meta.glob<Record<string, string>>('../../locales/*.json', {
    eager: true,
    import: 'default',
  }),
  pages: [
    {
      path: 'remote',
      component: lazy(() => import('./RemotePage')),
      nav: { label: 'nav.remote', icon: 'cloud', section: 'system', requires: 'settings.manage' },
    },
  ],
});
