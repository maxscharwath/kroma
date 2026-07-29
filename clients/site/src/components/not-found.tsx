import { Button } from '#site/components/button';
import { WheelMark } from '#site/components/wheel-mark';
import { useCommon } from '#site/lib/messages/common';

/** The branded 404, in the reader's language. Served by the SPA fallback for any
 *  path the prerender did not emit, so it stands on its own: mark, one line, a
 *  way home. */
export function NotFound() {
  const t = useCommon();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <WheelMark size={64} className="opacity-90" />
      <p className="mt-8 font-display text-6xl font-extrabold text-text">{t.notFound.code}</p>
      <p className="mt-3 max-w-md text-lg text-muted">{t.notFound.body}</p>
      <div className="mt-8">
        <Button to="/">{t.notFound.home}</Button>
      </div>
    </div>
  );
}
