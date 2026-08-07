import { Avatar } from '@kroma/ui/kit';
import { imageUrl } from '#web/shared/lib/api';

// The deterministic gradient + initials are the design system's own, so an
// account keeps the same colour on the TV, the phone and here.
export { gradientFor as avatarGradient, initialsOf as initials } from '@kroma/ui/kit';

/**
 * Account avatar in the KROMA shape: a rounded-square gradient with Bricolage
 * initials, with the uploaded WebP photo layered over it once loaded (the kit
 * Avatar handles the swap, so SSR shows initials and the photo fades in).
 */
export function UserAvatar({
  name,
  avatarUrl,
  seed,
  size = 138,
  radius,
  className = '',
}: Readonly<{
  name: string;
  avatarUrl?: string | null;
  seed?: string;
  size?: number;
  radius?: number;
  className?: string;
}>) {
  const roundness = (radius ?? Math.round(size * 0.13)) / size;
  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      <Avatar
        name={name}
        seed={seed}
        src={avatarUrl ? imageUrl(avatarUrl) : null}
        size={size}
        roundness={roundness}
        shadow={false}
      />
    </span>
  );
}
