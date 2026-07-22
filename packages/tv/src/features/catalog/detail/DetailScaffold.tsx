import { posterColors } from '@kroma/core';
import { Badge, Box, gradient, Img, qualityTone, Txt, tintGradient } from '@kroma/ui/kit';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { TvTopNav } from '#tv/features/catalog/home/TopNav';

// Two layers rather than one comma-separated background-image: multi-value
// backgrounds are a CSS-only luxury React Native's gradient support lacks.
const VEIL_HORIZONTAL = 'linear-gradient(90deg, #0A0A0C 12%, transparent 68%)';
const VEIL_VERTICAL = 'linear-gradient(0deg, #0A0A0C 4%, transparent 60%)';

const KIND = {
  fontWeight: '700' as const,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: 2.6,
  textTransform: 'uppercase' as const,
};

// clamp(46px, 7.6vh, 86px) resolves to 82px on the fixed 1080-tall stage.
const TITLE = { fontSize: 82, lineHeight: 78, fontWeight: '700' as const, letterSpacing: -1.64 };

/**
 * Shared chrome for the Film / Série detail screens: full-bleed backdrop, veil,
 * the overline + title + meta row + synopsis header, and the persistent top nav.
 * Screen-specific actions and extras render as `children`; they come before the
 * nav in the tree, so the first action (Lecture) stays the initial spatial-focus
 * target on mount.
 */
export function TvDetailScaffold({
  id,
  kind,
  title,
  backdrop,
  rating,
  meta,
  badge,
  overview,
  children,
}: Readonly<{
  id: string;
  kind: string;
  title: string;
  backdrop: string | null;
  rating: number | null | undefined;
  meta: string;
  badge: string | null;
  overview: string | null | undefined;
  children: ReactNode;
}>) {
  return (
    <Box fill bg="bg" overflow="hidden">
      <Img src={backdrop} background={tintGradient(posterColors(id))} position="50% 18%" fill />
      <Box fill pointerEvents="none" style={gradient(VEIL_HORIZONTAL)} />
      <Box fill pointerEvents="none" style={gradient(VEIL_VERTICAL)} />

      <ScrollView
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        contentContainerStyle={{ paddingHorizontal: 64, paddingTop: 367, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        <Txt style={KIND} color="accent">
          {kind}
        </Txt>
        <Txt variant="hero" style={[TITLE, { marginTop: 14, marginBottom: 16 }]}>
          {title}
        </Txt>

        <Box row wrap align="center" gap={13} mb={18}>
          {rating ? (
            <>
              <Txt style={{ fontSize: 18, fontWeight: '700' }} color="accent">
                {`${rating.toFixed(1)}★`}
              </Txt>
              <Txt style={{ fontSize: 18, fontWeight: '600' }} color="textDim">
                ·
              </Txt>
            </>
          ) : null}
          <Txt style={{ fontSize: 18, fontWeight: '600' }} color="textMuted">
            {meta}
          </Txt>
          {badge ? <Badge tone={qualityTone(badge)}>{badge}</Badge> : null}
        </Box>

        {overview ? (
          <Txt
            lines={3}
            style={{ fontSize: 20, lineHeight: 30, maxWidth: 680, marginBottom: 26 }}
            color="rgba(244, 243, 240, 0.82)"
          >
            {overview}
          </Txt>
        ) : null}

        {children}
      </ScrollView>

      {/* Persistent nav (brand + section pills) for quick jumps. Rendered after
          the content so the first action (Lecture) stays the initial focus. */}
      <TvTopNav />
    </Box>
  );
}
