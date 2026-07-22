import type { GenQuality, SubCapabilities } from '@kroma/core';
import { GEN_LANGS, GEN_QUALITIES } from '@kroma/core';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Pressable } from 'react-native';
import { useT } from '../../i18n';
import { gradient } from '../../primitives/css';
import { Txt } from '../../primitives/Text';
import { Box } from '../../system/Box';
import { colors } from '../../tokens';
import { IconAi, IconClose } from '../icons';
import type { PanelHandle } from '../nav';
import { FOCUS_SHADOW_SM } from '../style';
import type { PlayerSub } from '../types';
import { useListFocus } from '../useListFocus';
import type { SubtitleGenRequest } from './gen';
import { panelEmpty } from './panelStyle';
import { ActionButton, CycleField } from './WizardParts';

type Mode = 'transcribe' | 'translate';

interface GenerateWizardProps {
  caps: SubCapabilities | null;
  sources: PlayerSub[];
  onStart: (req: SubtitleGenRequest) => void;
  onClose: () => void;
}

/** One focusable wizard field, in display order for the current mode. */
interface Field {
  key: 'mode' | 'lang' | 'quality' | 'source' | 'start';
  nudge?: (dir: -1 | 1) => void;
  activate?: () => void;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The on-device subtitle-generation form (§5), prop-driven so @kroma/ui stays
 * client-agnostic. Mode tabs pick transcribe (Whisper) / translate (LLM); ▲▼ move
 * between cycle fields, ◀▶ change the focused field, OK on the last row emits a
 * {@link SubtitleGenRequest} and closes. Modes are gated by `caps`.
 */
export const GenerateWizard = forwardRef<PanelHandle, GenerateWizardProps>(function GenerateWizard(
  { caps, sources, onStart, onClose },
  ref,
) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(caps?.transcribe ? 'transcribe' : 'translate');
  const [langIndex, setLangIndex] = useState(0);
  const [quality, setQuality] = useState<GenQuality>('balanced');
  const [sourceIndex, setSourceIndex] = useState(0);

  const qualityLabel = (q: GenQuality) => {
    if (q === 'fast') return t('player.subQualityFast');
    if (q === 'accurate') return t('player.subQualityAccurate');
    return t('player.subQualityBalanced');
  };
  const sourceLabel = (s: PlayerSub) =>
    s.label ||
    (s.language ?? '').toUpperCase() ||
    t('player.subtitleTrack', { number: s.index + 1 });

  const toggleMode = () => {
    if (caps?.transcribe && caps?.translate) {
      setMode((m) => (m === 'transcribe' ? 'translate' : 'transcribe'));
    }
  };
  const start = () => {
    if (mode === 'transcribe') {
      const lang = GEN_LANGS[langIndex] ?? GEN_LANGS[0];
      onStart({ mode: 'transcribe', lang: lang?.code, quality });
    } else {
      const src = sources[sourceIndex];
      if (!src) return;
      onStart({ mode: 'translate', sourceIndex: src.index });
    }
    onClose();
  };

  const cycleLang = (d: -1 | 1) => setLangIndex((i) => mod(i + d, GEN_LANGS.length));
  const cycleQuality = (d: -1 | 1) =>
    setQuality((q) => GEN_QUALITIES[mod(GEN_QUALITIES.indexOf(q) + d, GEN_QUALITIES.length)] ?? q);
  const cycleSource = (d: -1 | 1) =>
    setSourceIndex((i) => (sources.length ? mod(i + d, sources.length) : 0));

  const fields: Field[] =
    mode === 'transcribe'
      ? [
          { key: 'mode', nudge: toggleMode },
          { key: 'lang', nudge: cycleLang },
          { key: 'quality', nudge: cycleQuality },
          { key: 'start', activate: start },
        ]
      : [
          { key: 'mode', nudge: toggleMode },
          { key: 'source', nudge: cycleSource },
          { key: 'start', activate: start },
        ];
  const at = (key: Field['key']) => fields.findIndex((f) => f.key === key);

  const focus = useListFocus({
    count: fields.length,
    onActivate: (i) => fields[i]?.activate?.(),
    onHorizontal: (i, d) => fields[i]?.nudge?.(d),
    onBack: onClose,
  });
  useImperativeHandle(ref, () => ({ onKey: focus.onKey }), [focus.onKey]);

  const curSource = sources[sourceIndex] ?? sources[0];
  const curLang = GEN_LANGS[langIndex] ?? GEN_LANGS[0];
  const noSource = mode === 'translate' && sources.length === 0;

  return (
    <Box
      radius={20}
      borderWidth={1}
      border="rgba(124, 92, 255, 0.34)"
      p={32}
      style={gradient('linear-gradient(180deg, rgba(124,92,255,0.1), rgba(124,92,255,0.02))')}
    >
      <Box row align="center" between gap={16} mb={24}>
        <Txt variant="h2" style={{ fontSize: 24 }}>
          {t('player.subGenerate')}
        </Txt>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('player.subGenClose')}>
          <Box w={36} h={36} shrink={0} center radius="pill" bg="rgba(255, 255, 255, 0.1)">
            <IconClose size={17} />
          </Box>
        </Pressable>
      </Box>

      {/* mode tabs (index 0): ◀▶ toggles, a press picks directly. */}
      <Box
        row
        gap={10}
        mb={14}
        radius={14}
        onPointerEnter={focus.hover(0)}
        style={focus.index === 0 ? { boxShadow: FOCUS_SHADOW_SM } : null}
      >
        <ModeTab
          on={mode === 'transcribe'}
          enabled={Boolean(caps?.transcribe)}
          label={t('player.subModeTranscribe')}
          hint={t('player.subModeTranscribeHint')}
          onPress={() => caps?.transcribe && setMode('transcribe')}
        />
        <ModeTab
          on={mode === 'translate'}
          enabled={Boolean(caps?.translate)}
          label={t('player.subModeTranslate')}
          hint={t('player.subModeTranslateHint')}
          onPress={() => caps?.translate && setMode('translate')}
        />
      </Box>

      <Box gap={12}>
        {mode === 'translate' && curSource != null ? (
          <CycleField
            label={t('player.subSource')}
            value={sourceLabel(curSource)}
            focused={focus.index === at('source')}
            onFocus={focus.hover(at('source'))}
            onDec={() => cycleSource(-1)}
            onInc={() => cycleSource(1)}
          />
        ) : null}
        {mode === 'translate' && curSource == null ? (
          <Txt style={panelEmpty}>{t('player.subNoSource')}</Txt>
        ) : null}
        {mode === 'transcribe' ? (
          <>
            <CycleField
              label={t('player.subSpokenLang')}
              value={curLang?.label ?? ''}
              focused={focus.index === at('lang')}
              onFocus={focus.hover(at('lang'))}
              onDec={() => cycleLang(-1)}
              onInc={() => cycleLang(1)}
            />
            <CycleField
              label={t('player.subQuality')}
              value={qualityLabel(quality)}
              focused={focus.index === at('quality')}
              onFocus={focus.hover(at('quality'))}
              onDec={() => cycleQuality(-1)}
              onInc={() => cycleQuality(1)}
            />
          </>
        ) : null}
      </Box>

      <Txt style={BACKGROUND_HINT} color="rgba(244, 243, 240, 0.4)">
        {t('player.subGenBackground')}
      </Txt>

      <ActionButton
        label={t('player.subGenStart')}
        focused={focus.index === at('start')}
        disabled={noSource}
        onFocus={focus.hover(at('start'))}
        onPress={start}
      >
        <IconAi size={18} />
      </ActionButton>
    </Box>
  );
});

const BACKGROUND_HINT = {
  marginHorizontal: 2,
  marginTop: 12,
  marginBottom: 4,
  fontWeight: '500' as const,
  fontSize: 14,
  lineHeight: 22,
};

/** One mode tab (transcribe / translate) with its hint line. */
function ModeTab({
  on,
  enabled,
  label,
  hint,
  onPress,
}: Readonly<{ on: boolean; enabled: boolean; label: string; hint: string; onPress: () => void }>) {
  const tone = modeTone(enabled, on);
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !enabled }}
      style={[{ flex: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 }, tone.box]}
    >
      <Txt style={{ fontWeight: '700', fontSize: 16 }} color={tone.ink}>
        {label}
      </Txt>
      <Txt style={{ fontSize: 12, opacity: 0.75 }} color={tone.ink}>
        {hint}
      </Txt>
    </Pressable>
  );
}

function modeTone(enabled: boolean, on: boolean) {
  if (!enabled) {
    return {
      box: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
      ink: 'rgba(244, 243, 240, 0.4)',
    };
  }
  if (on) return { box: { backgroundColor: colors.accent }, ink: colors.accentInk };
  return {
    box: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    ink: 'rgba(244, 243, 240, 0.75)',
  };
}
