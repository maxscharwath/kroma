import { Button } from '#site/components/button';
import { WheelMark } from '#site/components/wheel-mark';

/** The branded 404. Served by the SPA fallback for any path the prerender did
 *  not emit, so it has to stand on its own, logo, one line, a way home. */
export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <WheelMark size={64} className="opacity-90" />
      <p className="mt-8 font-display text-6xl font-extrabold text-text">404</p>
      <p className="mt-3 max-w-md text-lg text-muted">
        Cette page a quitté la grille. Le catalogue, lui, est toujours là.
      </p>
      <div className="mt-8">
        <Button to="/">Retour à l'accueil</Button>
      </div>
    </div>
  );
}
