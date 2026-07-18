import { langName } from '@kroma/core';
import { forwardRef, type ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { useT } from '../i18n';
import {
  IconAppearance,
  IconAudioFilter,
  IconAudioTrack,
  IconBack,
  IconLoop,
  IconQuality,
  IconSpeed,
  IconStats,
  IconSubtitles,
} from './icons';
import type { PanelHandle } from './nav';
import { AudioFilterPanel } from './settings/AudioFilterPanel';
import { AudioPanel } from './settings/AudioPanel';
import type { SubtitleGenBundle } from './settings/gen';
import { MenuRow } from './settings/MenuRow';
import { QualityPanel } from './settings/QualityPanel';
import { SpeedPanel } from './settings/SpeedPanel';
import { SubtitleAppearancePanel } from './settings/SubtitleAppearancePanel';
import { SubtitlesPanel } from './settings/SubtitlesPanel';
import type { SubtitleAppearance } from './subtitle-appearance';
import { PANEL } from './tw';
import type { PlayerController } from './types';
import { useListFocus } from './useListFocus';

// Sub-views the menu can open; toggles (loop/statistics) act in place.
type View = 'menu' | 'quality' | 'audio' | 'audioFilter' | 'subtitles' | 'appearance' | 'speed';

interface SettingsPanelProps {
  controller: PlayerController;
  appearance: SubtitleAppearance;
  onAppearance: (p: Partial<SubtitleAppearance>) => void;
  statsOn: boolean;
  onToggleStats: () => void;
  subtitleGen: SubtitleGenBundle;
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

/**
 * The right-side settings panel (§5): a two-level surface over a click-to-close
 * scrim. A main menu lists every setting; OK opens a sub-view (or toggles Loop /
 * Statistics in place). Keys route to the open sub-view's {@link PanelHandle} when
 * one is open, else to the menu. Back in a sub-view returns to the menu (consumed);
 * Back in the menu bubbles out so the shell closes the panel.
 */
export const SettingsPanel = forwardRef<PanelHandle, SettingsPanelProps>(function SettingsPanel(
  {
    controller: c,
    appearance,
    onAppearance,
    statsOn,
    onToggleStats,
    subtitleGen,
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

  let subValue: string;
  if (!curSub) subValue = t('player.subtitlesOff');
  else if (curSub.ai && curSub.label) subValue = curSub.label;
  else subValue = langName(t, curSub.language) || t('player.langUnknown');

  const entries: Entry[] = [
    {
      id: 'quality',
      icon: <IconQuality />,
      label: t('player.quality'),
      value: curQuality?.label,
      activate: () => setView('quality'),
    },
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
  ];

  const menuFocus = useListFocus({
    count: entries.length,
    onActivate: (i) => entries[i]?.activate(),
  });
  useImperativeHandle(
    ref,
    () => ({
      onKey: (k) => (view === 'menu' ? menuFocus.onKey(k) : Boolean(subRef.current?.onKey(k))),
    }),
    [view, menuFocus.onKey],
  );

  const title =
    view === 'menu' ? t('player.settings') : (entries.find((e) => e.id === view)?.label ?? '');

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a click-to-close scrim; Back on the D-pad closes the panel, this only mirrors it for the mouse (§15). */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Back is handled by the shell's D-pad routing, so this scrim needs no element-level key handler. */}
      <div className="absolute inset-y-0 left-0 z-[41] w-[56%] cursor-pointer" onClick={onClose} />
      <div className={`${PANEL} w-[44%] max-w-[720px] px-[58px] py-14`}>
        <div className="mb-[30px] flex items-center gap-[18px]">
          {view !== 'menu' ? (
            <button
              type="button"
              onClick={backToMenu}
              aria-label={t('player.back')}
              className="flex flex-none h-[46px] w-[46px] items-center justify-center rounded-full border-none cursor-pointer text-text bg-[rgba(255,255,255,0.1)]"
            >
              <IconBack size={21} />
            </button>
          ) : null}
          <h2 className="m-0 font-display font-bold text-[38px] text-text">{title}</h2>
        </div>

        {view === 'menu' ? (
          <div className="flex flex-col gap-3">
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
          </div>
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
        {view === 'speed' ? (
          <SpeedPanel
            ref={subRef}
            rate={c.rate}
            onSelect={(r) => c.setRate(r)}
            onBack={backToMenu}
          />
        ) : null}
      </div>
    </>
  );
});
