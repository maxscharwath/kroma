import { KromaClient } from '@kroma/core';
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
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useConnectionMaybe } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';

const BACKDROP = `radial-gradient(120% 90% at 50% 0%, #15131C, ${colors.bg} 68%)`;

/** The public `/api/splash` sample mapped for the kit's universal splash
 * backdrop, so the TV gate dresses like the web and phone ones. Empty until
 * the server answers (or when it has no artwork), which keeps the radial. */
function useSplashCovers(): SplashCover[] {
  const t = useT();
  const connection = useConnectionMaybe();
  // `/api/splash` is public and these screens run BEFORE a server is active,
  // so the art comes from whichever server this device knows: the active one
  // first, then the saved list, then whatever discovery just found.
  const urls = useMemo(() => {
    const all = [
      connection?.activeServerUrl,
      ...(connection?.servers ?? []).map((s) => s.url),
      ...(connection?.discovered ?? []),
    ];
    return [...new Set(all.filter((u): u is string => Boolean(u)))];
  }, [connection?.activeServerUrl, connection?.servers, connection?.discovered]);

  const [covers, setCovers] = useState<SplashCover[]>([]);
  useEffect(() => {
    let cancelled = false;
    // Each candidate in turn, stopping at the first that answers: a household
    // can hold a server too old to know this route, and it serves the SPA's
    // index.html for it rather than a 404, which is not artwork.
    void (async () => {
      for (const url of urls) {
        try {
          const entries = await new KromaClient({ baseUrl: url }).splash();
          if (cancelled) return;
          if (entries.length === 0) continue;
          setCovers(
            entries.map((e) => ({
              url: e.backdropUrl,
              caption: [e.title, e.year].filter(Boolean).join(' · '),
              eyebrow: t(e.kind === 'show' ? 'content.series' : 'content.film'),
            })),
          );
          return;
        } catch {
          /* try the next server */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urls, t]);
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
      {/* Auth content (lists, keyboards, hints) descends into the ribbon
          zone on a TV, so the splash carries a wash over the ribbons here:
          muted ink stays AA-readable and the colour still comes through. */}
      <SplashBackdrop covers={covers} dim={0.45} />
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
