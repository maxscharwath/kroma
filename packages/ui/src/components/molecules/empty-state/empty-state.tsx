import type { ReactNode } from 'react';
import { Box } from '#ui/components/atoms/box';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  hint?: string;
  /** The raw cause, when there is one worth showing: an error message, a
   *  path. Set apart in a chip under the hint, the way the error pages do. */
  detail?: string;
  action?: ReactNode;
  tv?: boolean;
  /**
   * The state IS the page: it fills the space it was given and centres in it,
   * rather than hanging below whatever came before. For a whole screen with
   * nothing on it (a module that failed to load), where the default top offset
   * strands the message against a large empty area.
   */
  fill?: boolean;
}

function EmptyState({
  icon,
  title,
  hint,
  detail,
  action,
  tv = false,
  fill = false,
}: Readonly<EmptyStateProps>) {
  return (
    <Box
      center
      flex={fill ? 1 : undefined}
      justify={fill ? 'center' : undefined}
      mt={fill ? 0 : TOP_OFFSET[tv ? 'tv' : 'page']}
      py={fill ? 64 : 0}
      gap={tv ? 16 : 10}
    >
      <Box center w={tv ? 88 : 64} h={tv ? 88 : 64} radius="pill" bg="white/5" border="white/8">
        <Icon name={icon} size={tv ? 40 : 26} color="textDim" />
      </Box>
      <Txt variant={tv ? 'h2' : 'title'} style={[s.centred, tv ? null : s.title]}>
        {title}
      </Txt>
      {hint ? (
        <Txt variant="body" color="textMuted" style={[s.centred, tv ? s.hintTv : s.hint]}>
          {hint}
        </Txt>
      ) : null}
      {detail ? (
        <Box bg="surface1" border="border" radius="md" px={14} py={10} maxW={420}>
          <Txt variant="meta" color="textDim" style={s.centred}>
            {detail}
          </Txt>
        </Box>
      ) : null}
      {action ? <Box mt={tv ? 8 : 6}>{action}</Box> : null}
    </Box>
  );
}

// How far a state that follows content hangs below it. `fill` sets this to 0
// and centres instead.
const TOP_OFFSET = { page: 64, tv: 96 } as const;

const s = styles({
  centred: { textAlign: 'center' },
  title: { mt: 6 },
  hint: { fontSize: 14.5, lineHeight: 22, maxW: 420 },
  hintTv: { maxW: 720 },
});

export type { EmptyStateProps };
export { EmptyState };
