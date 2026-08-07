import { useT } from '@kroma/ui';
import {
  BackButton,
  Box,
  colors,
  FocusScroll,
  gradient,
  SplashBackdrop,
  type SplashCover,
  styles,
} from '@kroma/ui/kit';
import { type ReactNode, useEffect, useState } from 'react';
import { useConnectionMaybe } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';

const BACKDROP = `radial-gradient(120% 90% at 50% 0%, #15131C, ${colors.bg} 68%)`;

/** The public `/api/splash` sample mapped for the kit's universal splash
 * backdrop, so the TV gate dresses like the web and phone ones. Empty until
 * the server answers (or when it has no artwork), which keeps the radial. */
function useSplashCovers(): SplashCover[] {
  const t = useT();
  const client = useConnectionMaybe()?.client ?? null;
  const [covers, setCovers] = useState<SplashCover[]>([]);
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client
      .splash()
      .then((entries) => {
        if (cancelled) return;
        setCovers(
          entries.map((e) => ({
            url: e.backdropUrl,
            caption: [e.title, e.year].filter(Boolean).join(' · '),
            eyebrow: t(e.kind === 'show' ? 'content.series' : 'content.film'),
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, t]);
  return covers;
}

/** The shared centred backdrop for the TV auth / connect / pin screens. The
 * pinned Back button self-hides at the signed-out root. */
export function AuthScreen({ children }: Readonly<{ children: ReactNode }>) {
  const nav = useNav();
  const t = useT();
  const covers = useSplashCovers();
  return (
    <Box fill z={10} style={gradient(BACKDROP)}>
      <SplashBackdrop covers={covers} />
      <FocusScroll style={s.scroll} contentStyle={s.content}>
        {children}
      </FocusScroll>
      {nav.canGoBack ? (
        <Box absolute left={32} top={28} z={20}>
          <BackButton onPress={nav.back} label={t('common.back')} />
        </Box>
      ) : null}
    </Box>
  );
}

const s = styles({
  scroll: { flex: true },
  // Growth and centring sit on the content, not the box, so it centres when it
  // fits and scrolls from the top when it does not.
  content: { grow: 1, center: true, px: 40, py: 48 },
});
