import type { ReportCategory } from '@kroma/core';
import { langName } from '@kroma/core';
import { forwardRef, type ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useT } from '../i18n';
import { Box } from '../ui/primitives/box';
import { Txt } from '../ui/primitives/text';
import {
  IconAppearance,
  IconAudioFilter,
  IconAudioTrack,
  IconBack,
  IconGear,
  IconLoop,
  IconQuality,
  IconReport,
  IconSpeed,
  IconStats,
  IconSubtitles,
} from './icons';
import type { PanelHandle } from './nav';
import { AudioFilterPanel } from './settings/AudioFilterPanel';
import { AudioPanel } from './settings/AudioPanel';
import type { SubtitleGenBundle } from './settings/gen';
import { MenuRow } from './settings/menu-row';
import { QualityPanel } from './settings/QualityPanel';
import { ReportPanel } from './settings/ReportPanel';
import { SpeedPanel } from './settings/SpeedPanel';
import { SubtitleAppearancePanel } from './settings/SubtitleAppearancePanel';
import { SubtitlesPanel } from './settings/SubtitlesPanel';
import { PANEL } from './style';
import type { SubtitleAppearance } from './subtitle-appearance';
import type { PlayerController, PlayerSub } from './types';
import { useListFocus } from './useListFocus';
import { VIRTUAL_FOCUS } from './virtual-focus';

// Sub-views the menu can open; toggles (loop/statistics) act in place.
type View =
  | 'menu'
  | 'quality'
  | 'engine'
  | 'audio'
  | 'audioFilter'
  | 'subtitles'
  | 'appearance'
  | 'speed'
  | 'report';

interface SettingsPanelProps {
  controller: PlayerController;
  appearance: SubtitleAppearance;
  onAppearance: (p: Partial<SubtitleAppearance>) => void;
  statsOn: boolean;
  onToggleStats: () => void;
  subtitleGen: SubtitleGenBundle;
  /** Report a problem with what is playing. The menu grows a "Signaler un
   * problème" row only when the host provides this, so a surface with its own
   * reporting flow (or none) is unaffected. */
  onReport?: (category: ReportCategory) => Promise<void>;
  /** Open straight into a sub-view (the Audio / Subtitles cluster quick-access). */
  initialView?: View;
  onClose: () => void;
}

/** One main-menu entry: a navigable sub-panel or an in-place toggle. */
interface Entry {
  id: View | 'loop' | 'stats';
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  toggle?: boolean;
  on?: boolean;
  activate: () => void;
}

/** The subtitles menu-row value: Off, an AI track's own label, else the language. */
function subtitleValue(t: ReturnType<typeof useT>, curSub: PlayerSub | null | undefined): string {
  if (!curSub) return t('player.subtitlesOff');
  if (curSub.ai && curSub.label) return curSub.label;
  return langName(t, curSub.language) || t('player.langUnknown');
}

/** The panel heading: "Settings" on the menu, else the open sub-view's label. */
function panelTitle(view: View, entries: Entry[], t: ReturnType<typeof useT>): string {
  if (view === 'menu') return t('player.settings');
  return entries.find((e) => e.id === view)?.label ?? '';
}

/**
 * The right-side settings panel (§5): a two-level surface over a click-to-close
 * scrim. A main menu lists every setting; OK opens a sub-view (or toggles Loop /
 * Statistics in place). Keys route to the open sub-view's {@link PanelHandle} when
 * one is open, else to the menu. Back in a sub-view returns to the menu; Back in
 * the menu closes the panel.
 */
export const SettingsPanel = forwardRef<PanelHandle, SettingsPanelProps>(function SettingsPanel(
  {
    controller: c,
    appearance,
    onAppearance,
    statsOn,
    onToggleStats,
    subtitleGen,
    onReport,
    initialView,
    onClose,
  },
  ref,
) {
  const t = useT();
  const [view, setView] = useState<View>(initialView ?? 'menu');
  const subRef = useRef<PanelHandle>(null);
  const backToMenu = () => setView('menu');

  const curQuality = c.qualities.find((q) => q.id === c.qualityId);
  const curAudio = c.audioTracks.find((a) => a.index === c.audioIndex);
  const curSub =
    c.subtitleIndex == null ? null : c.subtitles.find((s) => s.index === c.subtitleIndex);
  const filterLabels = {
    off: t('player.audioFilterOff'),
    standard: t('player.audioFilterStandard'),
    night: t('player.audioFilterNight'),
  } as const;

  const subValue = subtitleValue(t, curSub);

  const entries: Entry[] = [
    {
      id: 'quality',
      icon: <IconQuality />,
      label: t('player.quality'),
      value: curQuality?.label,
      activate: () => setView('quality'),
    },
    ...(c.engines?.length
      ? [
          {
            id: 'engine' as const,
            icon: <IconGear />,
            label: t('playbackEngine.title'),
            value: c.engines.find((e) => e.id === c.engineId)?.label,
            activate: () => setView('engine'),
          },
        ]
      : []),
    {
      id: 'audio',
      icon: <IconAudioTrack />,
      label: t('player.audioTrack'),
      value: curAudio
        ? curAudio.title?.trim() || langName(t, curAudio.language) || t('player.langUnknown')
        : undefined,
      activate: () => setView('audio'),
    },
    ...(c.audioFilterSupported
      ? [
          {
            id: 'audioFilter' as const,
            icon: <IconAudioFilter />,
            label: t('player.audioFilters'),
            value: filterLabels[c.audioFilter],
            activate: () => setView('audioFilter'),
          },
        ]
      : []),
    {
      id: 'subtitles',
      icon: <IconSubtitles />,
      label: t('player.subtitles'),
      value: subValue,
      activate: () => setView('subtitles'),
    },
    {
      id: 'appearance',
      icon: <IconAppearance />,
      label: t('player.subAppearance'),
      activate: () => setView('appearance'),
    },
    {
      id: 'speed',
      icon: <IconSpeed />,
      label: t('player.speed'),
      value: c.rate === 1 ? t('player.normalSpeed') : `${c.rate}×`,
      activate: () => setView('speed'),
    },
    {
      id: 'loop',
      icon: <IconLoop />,
      label: t('player.loop'),
      toggle: true,
      on: c.loop,
      activate: () => c.setLoop(!c.loop),
    },
    {
      id: 'stats',
      icon: <IconStats />,
      label: t('player.stats'),
      toggle: true,
      on: statsOn,
      activate: onToggleStats,
    },
    // Last on purpose: it is the row nobody wants to need, and the one that must
    // be there when they do.
    ...(onReport
      ? [
          {
            id: 'report' as const,
            icon: <IconReport />,
            label: t('report.action'),
            activate: () => setView('report'),
          },
        ]
      : []),
  ];

  const menuFocus = useListFocus({
    count: entries.length,
    onActivate: (i) => entries[i]?.activate(),
    // Back at the menu closes the panel, here rather than by declining the key
    // and trusting the shell to notice: that fall-through never fired on Apple
    // TV, and a settings panel you cannot leave with the remote's Back button is
    // a dead end in the middle of a film.
    onBack: onClose,
  });
  useImperativeHandle(
    ref,
    () => ({
      onKey: (k) => (view === 'menu' ? menuFocus.onKey(k) : Boolean(subRef.current?.onKey(k))),
    }),
    [view, menuFocus.onKey],
  );

  const title = panelTitle(view, entries, t);

  return (
    <>
      {/* Press-to-close scrim; Back on the D-pad closes the panel and this
          mirrors it for a pointer (§15). */}
      <Pressable
        {...VIRTUAL_FOCUS}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '56%', zIndex: 41 }}
      />
      <ScrollView
        style={[PANEL, { width: '44%', maxWidth: 720 }]}
        contentContainerStyle={{ paddingHorizontal: 58, paddingVertical: 56 }}
        showsVerticalScrollIndicator={false}
      >
        <Box row align="center" gap={18} mb={30}>
          {view !== 'menu' ? (
            <Pressable
              {...VIRTUAL_FOCUS}
              onPress={backToMenu}
              accessibilityRole="button"
              accessibilityLabel={t('player.back')}
            >
              <Box w={46} h={46} shrink={0} center radius="pill" bg="rgba(255, 255, 255, 0.1)">
                <IconBack size={21} />
              </Box>
            </Pressable>
          ) : null}
          <Txt variant="h1" style={{ fontSize: 38 }}>
            {title}
          </Txt>
        </Box>

        {view === 'menu' ? (
          <Box gap={12}>
            {entries.map((e, i) => (
              <MenuRow
                key={e.id}
                icon={e.icon}
                label={e.label}
                value={e.value}
                toggle={e.toggle}
                on={e.on}
                focused={menuFocus.index === i}
                onActivate={e.activate}
                onFocus={menuFocus.hover(i)}
              />
            ))}
          </Box>
        ) : null}

        {view === 'quality' ? (
          <QualityPanel
            ref={subRef}
            qualities={c.qualities}
            current={c.qualityId}
            onSelect={(id) => c.setQuality(id)}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'engine' && c.engines ? (
          // Engine options share the quality picker's shape (single-select id/label).
          <QualityPanel
            ref={subRef}
            qualities={c.engines}
            current={c.engineId ?? ''}
            onSelect={(id) => c.setEngine?.(id)}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'audio' ? (
          <AudioPanel
            ref={subRef}
            tracks={c.audioTracks}
            current={c.audioIndex}
            onSelect={(i) => c.setAudio(i)}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'audioFilter' ? (
          <AudioFilterPanel
            ref={subRef}
            value={c.audioFilter}
            onSelect={(m) => c.setAudioFilter(m)}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'subtitles' ? (
          <SubtitlesPanel
            ref={subRef}
            subs={c.subtitles}
            current={c.subtitleIndex}
            onSelect={(i) => c.setSubtitle(i)}
            gen={subtitleGen}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'appearance' ? (
          <SubtitleAppearancePanel
            ref={subRef}
            appearance={appearance}
            onAppearance={onAppearance}
            onBack={backToMenu}
          />
        ) : null}
        {view === 'report' && onReport ? (
          <ReportPanel ref={subRef} onReport={onReport} onBack={backToMenu} />
        ) : null}
        {view === 'speed' ? (
          <SpeedPanel
            ref={subRef}
            rate={c.rate}
            onSelect={(r) => c.setRate(r)}
            onBack={backToMenu}
          />
        ) : null}
      </ScrollView>
    </>
  );
});
