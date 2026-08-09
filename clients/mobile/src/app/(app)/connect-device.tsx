// Connect a device: two roads to the same place, and the reader picks which.
//
// - `network`: the televisions waiting on this network, one tap each
//   (POST /handoff/grant). Asks nothing of anybody, and is therefore first.
// - `scan`: the road that works from anywhere - across subnets, from cellular,
//   from a television that cannot be heard. Scan the QR the TV shows (the code
//   rides its query params) or type the 4-digit code
//   (POST /auth/quickconnect/authorize).
//
// A segmented control rather than one long page: stacked, the two roads put a
// viewfinder, a keyboard and a list of televisions inside the same 700 points,
// and only the tallest phone reached the bottom. One mode is mounted at a time,
// so the camera never runs behind the list it is not in.
//
// HOW THE KEYBOARD IS SURVIVED, since this page has no scroll view and should
// not need one: everything in `scan` is a fixed height except the viewfinder,
// which is `flex` with a square aspect. When the keyboard takes half the screen
// the column shrinks and the viewfinder is the one thing that gives, so the code
// cells it belongs to stay on screen instead of being cropped behind the keys.
// A ScrollView here does NOT work: its parent is a flex column with no
// intrinsic height to hand down, so it collapses to nothing and takes the
// camera and the cells with it.
//
// The same televisions also appear in the cast picker (<CastDeviceList>), which
// is where somebody already choosing a screen will look for them.

import { Box, Icon, Keypad, OtpField, SegmentedControl, styles, Txt } from '@kroma/ui/kit';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { NearbyTvs } from '#mobile/components/NearbyTvs';
import {
  OnboardingBox,
  OnboardingScreen,
  OnboardingTitle,
} from '#mobile/components/OnboardingScreen';
import { ErrorBanner } from '#mobile/components/ui';
import { useT } from '#mobile/lib/i18n';
import { goBack } from '#mobile/lib/nav';
import { useClient } from '#mobile/lib/session';
import { colors, radius, spacing, type } from '#mobile/lib/theme';

// expo-camera is a NATIVE module and expo-router imports every route at boot:
// a static import would crash the whole app on a binary built before the
// module was added. Load it lazily so scanning is simply unavailable there.
function loadCamera(): typeof import('expo-camera') | null {
  try {
    return require('expo-camera');
  } catch {
    return null;
  }
}
const camera = loadCamera();

const QUERY_CODE = /[?&]code=(\d{4,8})/;
const BARE_CODE = /^\d{4,8}$/;

// `network` leads because it is the one that asks nothing of the reader.
const MODES = ['network', 'scan'] as const;
type ConnectMode = (typeof MODES)[number];

/** Pull a Quick Connect code out of a scanned QR payload: the authorize URL's
 * `code` query param, or a bare numeric code. */
export function codeFromQr(payload: string): string | null {
  const fromQuery = QUERY_CODE.exec(payload);
  if (fromQuery?.[1]) return fromQuery[1];
  const bare = BARE_CODE.exec(payload.trim());
  return bare ? bare[0] : null;
}

export default function ConnectDevice() {
  const t = useT();
  const client = useClient();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [cameraOn, setCameraOn] = useState(false);
  const [mode, setMode] = useState<ConnectMode>('scan');
  const scannedRef = useRef(false);

  const submit = async (value: string) => {
    setState('busy');
    try {
      await client.quickConnectAuthorize(value);
      setState('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setState('error');
      setCode('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const onChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setCode(digits);
    if (state === 'error') setState('idle');
    if (digits.length === 4) void submit(digits);
  };

  // Only while the scanner is the mode on screen: asking on mount turned the
  // viewfinder on behind the list of televisions, for readers who never picked
  // that road.
  useEffect(() => {
    if (!camera || mode !== 'scan') return;
    let cancelled = false;
    void (async () => {
      const current = await camera.Camera.getCameraPermissionsAsync();
      if (cancelled) return;
      if (current.granted) setCameraOn(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const enableCamera = async () => {
    if (!camera) return;
    const result = await camera.Camera.requestCameraPermissionsAsync();
    if (result.granted) setCameraOn(true);
  };

  const onScanned = (payload: string) => {
    if (scannedRef.current || state === 'busy') return;
    const scanned = codeFromQr(payload);
    if (!scanned) return;
    scannedRef.current = true;
    setCode(scanned);
    void submit(scanned);
  };

  if (state === 'done') {
    return (
      <OnboardingScreen onBack={() => goBack(router)} settings={false}>
        <OnboardingBox>
          <Box style={s.done}>
            <Box style={s.doneBadge}>
              <Icon name="check" size={34} stroke={2.4} color={colors.accentInk} />
            </Box>
            <OnboardingTitle
              title={t('connect.connected')}
              subtitle={t('connect.willConnectSoon')}
            />
          </Box>
        </OnboardingBox>
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      keyboardBehavior="height"
      onBack={() => goBack(router)}
      settings={false}
      brand={false}
    >
      <OnboardingBox>
        <OnboardingTitle title={t('connect.title')} />

        <SegmentedControl
          value={mode}
          onChange={setMode}
          label={t('connect.title')}
          options={MODES.map((m) => ({ value: m, label: t(`connect.mode.${m}`) }))}
          stretch
        />

        {/* Under the control, because it describes the mode the control just
            selected. Above it, it read as a description of the title. */}
        <Txt style={s.modeDesc}>
          {mode === 'network' ? t('handoff.nearbySub') : t('connect.scanOrType')}
        </Txt>

        {mode === 'network' ? (
          <NearbyTvs />
        ) : (
          <Box style={s.scan}>
            <Box style={s.cameraBox}>
              {camera && cameraOn ? (
                <>
                  <camera.CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={({ data }) => onScanned(data)}
                  />
                  <Box style={s.cameraFrame} pointerEvents="none" />
                </>
              ) : (
                <Pressable
                  onPress={() => void enableCamera()}
                  disabled={!camera}
                  style={({ pressed }) => [
                    s.cameraOff,
                    pressed && { backgroundColor: colors.surfaceHigh },
                  ]}
                >
                  <Icon name="scan" size={34} stroke={1.8} color={colors.accent} />
                  <Txt style={s.cameraOffLabel}>{t('connect.scanTvQr')}</Txt>
                </Pressable>
              )}
            </Box>

            {/* The kit's own pad, NOT the system keyboard, and `physicalKeyboard`
                is therefore off: the cells are presentational and the pad below
                feeds them.

                Two things fall out of that, both of which resisted every fix
                while a UIKit keyboard was involved. iOS puts an AutoFill chip
                over a `number-pad` - measured, and no combination of
                `textContentType="none"`, `autoComplete="off"`, `autoCorrect`,
                `spellCheck` or `importantForAutofill` suppresses it, because it
                belongs to the keyboard rather than to the field. And a keyboard
                that owns the bottom half of the screen is what cropped the
                cells and the scanner. A pad we draw has neither problem: no
                chip, and its height is ours. */}
            <OtpField
              maxLength={4}
              value={code}
              onChange={onChange}
              invalid={state === 'error'}
              disabled={state === 'busy'}
            />
            <Keypad
              autoFocus={false}
              disabled={state === 'busy'}
              onDigit={(digit) => onChange(code + digit)}
              onDelete={() => onChange(code.slice(0, -1))}
            />
          </Box>
        )}

        <ErrorBanner message={state === 'error' ? t('connect.invalidCode') : null} />
      </OnboardingBox>
    </OnboardingScreen>
  );
}

const s = styles({
  done: { align: 'center', gap: spacing.md },
  doneBadge: { center: true, w: 72, h: 72, bg: 'accent', radius: 36 },
  modeDesc: { ...type.caption, color: 'textDim', textAlign: 'center' },
  scan: { flex: true, align: 'center', gap: spacing.lg, pt: spacing.sm },
  // The one thing on this page that gives. `flex` with a square aspect and a
  // floor: it takes what the keyboard leaves, never grows past a thumb's reach,
  // and never shrinks so far that there is nothing to aim at.
  cameraBox: {
    flex: true,
    aspectRatio: 1,
    self: 'center',
    maxH: 260,
    minH: 96,
    bg: 'surface2',
    radius: radius.lg,
    overflow: 'hidden',
  },
  cameraOff: { fill: true, center: true, gap: 10, px: spacing.md },
  cameraOffLabel: { ...type.caption, color: 'accent', fontWeight: '700', textAlign: 'center' },
  cameraFrame: {
    absolute: true,
    top: 16,
    right: 16,
    bottom: 16,
    left: 16,
    radius: radius.md,
    border: 'accent',
    borderWidth: 2,
  },
});
