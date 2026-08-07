import type { ReactNode } from 'react';
import { Box } from '#ui/components/atoms/box';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  hint?: string;
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
      gap={tv ? 16 : 8}
    >
      <Icon name={icon} size={tv ? 64 : 32} color="textDim" />
      <Txt variant={tv ? 'h2' : 'label'} style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {hint ? (
        <Txt
          variant={tv ? 'body' : 'meta'}
          color="textDim"
          style={{ textAlign: 'center', maxWidth: tv ? 720 : 400 }}
        >
          {hint}
        </Txt>
      ) : null}
      {action}
    </Box>
  );
}

// How far a state that follows content hangs below it. `fill` sets this to 0
// and centres instead.
const TOP_OFFSET = { page: 64, tv: 96 } as const;

export type { EmptyStateProps };
export { EmptyState };
