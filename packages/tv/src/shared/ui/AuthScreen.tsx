// The shared radial backdrop for the TV auth / connect / pin screens.

import { Box, gradient } from '@kroma/ui/kit';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { TvBackButton } from '#tv/shared/ui/BackButton';

const BACKDROP = 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 68%)';

/** The shared centred backdrop for the auth / connect / pin screens. Scrolling
 * lives on the outer element and the content centres in an inner wrapper that
 * grows to fill it, so it sits centred when it fits but scrolls from the top
 * (never clipping the title) when the content is taller than the screen. A
 * pinned Back button (mouse users) sits top-left on any pushed screen; it
 * self-hides at the signed-out root (the profile picker). */
export function AuthScreen({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box fill z={10} style={gradient(BACKDROP)}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
          paddingVertical: 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <Box absolute left={32} top={28} z={20}>
        <TvBackButton />
      </Box>
    </Box>
  );
}
