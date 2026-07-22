// <Avatar>: the profile / cast disc. A photo when there is one, otherwise a
// deterministic gradient with the person's initials, so a profile is never a
// blank circle and always keeps the same colour everywhere it appears.

import { Box } from '../system/Box';
import { fonts, radius as radii } from '../tokens';
import { Icon } from './Icon';
import { Img } from './Img';
import { Txt } from './Text';

/** Vivid avatar gradients: one palette across the web and TV profile pickers. */
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #F4B642, #E8743B)',
  'linear-gradient(135deg, #3BC9DB, #3B82F6)',
  'linear-gradient(135deg, #A855F7, #6366F1)',
  'linear-gradient(135deg, #F472B6, #EC4899)',
  'linear-gradient(135deg, #34D399, #10B981)',
] as const;

/** The brand's warm default, first in the palette. */
export const AVATAR_GRADIENT = AVATAR_GRADIENTS[0];

/** Stable gradient for a seed (a user id, a person's name), so a profile keeps
 * its colour on every screen and on every device. */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + (seed.codePointAt(i) ?? 0)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length] as string;
}

/** One or two letters for the fallback: the first and last name's initials, or
 * the first two characters of a single-word name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts.at(-1) ?? first;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export interface AvatarProps {
  name?: string;
  /** Photo URL. Falls back to the initials on error or when absent. */
  src?: string | null;
  size?: number;
  /** Seed for the deterministic gradient. Defaults to `name`. */
  seed?: string;
  /** Override the gradient outright (the cast row cycles by position). */
  gradient?: string;
  /** Corner radius. Defaults to a rounded square at 16% of the size; pass
   *  `radius.pill` for a full circle. */
  radius?: number;
  /** Amber padlock badge for a PIN-protected profile. */
  locked?: boolean;
  /** Drop shadow. On by default: a profile disc floats above the backdrop. */
  shadow?: boolean;
}

export function Avatar({
  name = '',
  src = null,
  size = 64,
  seed,
  gradient,
  radius,
  locked = false,
  shadow = true,
}: Readonly<AvatarProps>) {
  const corner = radius ?? Math.round(size * 0.16);
  const fill = gradient ?? gradientFor(seed ?? name);
  const badge = Math.max(24, size * 0.2);
  return (
    <Box w={size} h={size} radius={corner} center overflow="hidden" style={shadow ? SHADOW : null}>
      <Img src={src} background={fill} radius={corner} fill alt={name} />
      {src ? null : (
        <Txt
          style={{
            fontFamily: fonts.display,
            fontWeight: '700',
            fontSize: Math.round(size * 0.38),
            lineHeight: Math.round(size * 0.46),
            color: 'rgba(255, 255, 255, 0.95)',
          }}
        >
          {initialsOf(name)}
        </Txt>
      )}
      {locked ? (
        <Box
          absolute
          right={8}
          bottom={8}
          w={badge}
          h={badge}
          center
          radius={radii.pill}
          bg="rgba(10, 10, 12, 0.8)"
        >
          <Icon name="lock" size={Math.max(14, size * 0.11)} color="accent" />
        </Box>
      ) : null}
    </Box>
  );
}

const SHADOW = { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)' } as const;
