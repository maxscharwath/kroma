import type { LumaModule } from '@luma/module-sdk';
import { lazy } from 'react';
import en from '../../locales/en.json';
import fr from '../../locales/fr.json';
import manifest from '../../module.json';

// The Downloads module (frontend half). Its id, version and dependencies come
// from the shared module.json this also feeds the backend crate, so the two
// halves cannot drift. It contributes the full "Downloads" admin page (the live
// queue + download-clients section) into the Acquisition sidebar group; disabling
// the module removes the page and 404s its backend routes together.
export const torrentsModule: LumaModule = {
  id: manifest.id,
  version: manifest.version,
  dependsOn: manifest.dependsOn,
  locales: { en, fr },
  navItems: [
    {
      to: '/admin/m/downloads',
      label: 'nav.downloads',
      icon: 'download',
      section: 'acquisition',
    },
  ],
  routes: [{ path: 'downloads', component: lazy(() => import('./DownloadsPage')) }],
};
