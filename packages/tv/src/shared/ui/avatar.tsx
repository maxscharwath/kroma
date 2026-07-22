// Profile avatars. The component and its deterministic gradient / initials
// helpers now live in the universal kit; this module keeps the TV app's original
// names pointing at them, and adapts the one prop shape that differs.

import { Avatar, Icon } from '@kroma/ui/kit';

export {
  AVATAR_GRADIENTS as AVATAR_GRADS,
  gradientFor as gradFor,
  initialsOf as initials,
} from '@kroma/ui/kit';

/** Rounded-square profile avatar: the uploaded photo when present, else a
 * deterministic gradient with the user's initials, plus an optional amber lock
 * badge for PIN-protected profiles. */
export function ProfileAvatar({
  name,
  seed,
  size,
  src,
  locked = false,
  radius,
}: Readonly<{
  name: string;
  seed: string;
  size: number;
  src?: string | null;
  locked?: boolean;
  radius?: number;
}>) {
  return <Avatar name={name} seed={seed} size={size} src={src} locked={locked} radius={radius} />;
}

/** Padlock glyph (lock badge / PIN headers). */
export function LockGlyph({ size = 16 }: Readonly<{ size?: number }>) {
  return <Icon name="lock" size={size} color="accent" />;
}
