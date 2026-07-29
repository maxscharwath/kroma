import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { NotFound } from '#site/components/not-found';
import { routeTree } from '#site/routeTree.gen';

// A content site: no query client, no auth. Just the route tree, with `intent`
// preloading so a hovered link fetches its chunk before the click.
export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
