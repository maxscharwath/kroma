// The sign-in gate's corner gear, the phone's answer to the TV's "Paramètres"
// chip and the web gate's corner panel: the few things that have to be
// reachable BEFORE anyone can sign in.
//
// Interface language only sets the DEVICE override here. Every other client
// syncs the choice to the account, but there is no account yet at the gate —
// and a viewer who cannot read the sign-in screen cannot get to one.

import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { LOCALES, type Locale } from '@kroma/core';
import { Box, Icon, IconButton, styles, Txt } from '@kroma/ui/kit';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { useI18n, useT } from '#mobile/lib/i18n';
import { colors, radius, spacing, type } from '#mobile/lib/theme';
import { SheetBody, SheetTitle, sheetChrome } from './ui/sheet';

export function GateSettings() {
  const t = useT();
  const { locale, setOverride } = useI18n();
  const sheet = useRef<BottomSheetModal>(null);

  return (
    <>
      {/* The same disc as <BackButton> in the opposite corner: same size, same
          scrim, so the gate's two corner controls read as a pair. */}
      <IconButton
        icon="settings"
        size={44}
        variant="scrim"
        focusFill
        ring={false}
        hitSlop={8}
        label={t('nav.settings')}
        onPress={() => sheet.current?.present()}
      />
      <BottomSheetModal ref={sheet} {...sheetChrome}>
        <SheetBody>
          <SheetTitle>{t('account.uiLanguage')}</SheetTitle>
          <Box style={s.card}>
            {LOCALES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => {
                  setOverride(l.code as Locale);
                  sheet.current?.dismiss();
                }}
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              >
                <Txt style={[s.rowLabel, locale === l.code && { fontWeight: '700' }]}>
                  {t(l.labelKey)}
                </Txt>
                {locale === l.code ? (
                  <Icon name="check" size={17} stroke={2.4} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </Box>
        </SheetBody>
      </BottomSheetModal>
    </>
  );
}

const s = styles({
  card: { px: 6, py: 4, bg: 'surface1', radius: radius.lg },
  row: { row: true, between: true, align: 'center', minH: 52, px: spacing.sm, radius: radius.md },
  rowPressed: { bg: 'surface2' },
  rowLabel: { ...type.body },
});
