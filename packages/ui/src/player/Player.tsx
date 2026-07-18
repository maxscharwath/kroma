import { formatTimecode as fmtTime, type Marker, type RemoteKey } from '@kroma/core';
import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocale, useT } from '../i18n';
import type { StoryboardTile } from '../storyboard';
import { ChapterProgressBar } from './ChapterProgressBar';
import { ControlCluster } from './ControlCluster';
import { CreditsCard, type CreditsCardItem } from './CreditsCard';
import { currentChapter, normalizeChapters } from './chapters';
import { endsAtClock } from './fmt';
import { IconBack10, IconFullscreenExit, IconPause, IconPlay } from './icons';
import type { PanelHandle } from './nav';
import { SettingsPanel } from './SettingsPanel';
import { SkipIntroButton } from './SkipIntroButton';
import { StatsPanel } from './StatsPanel';
import { SubtitleRenderer } from './SubtitleRenderer';
import type { SubtitleGenBundle } from './settings/gen';
import { injectKeyframes } from './styles';
import type { SubtitleAppearance } from './subtitle-appearance';
import { TopBar } from './TopBar';
import type { Chapter, PlayerController, PlayerFlags } from './types';
import { type UpNextData, type UpNextItem, UpNextSheet } from './UpNextSheet';
import { usePlayerCredits } from './usePlayerCredits';
import { usePlayerKeys } from './usePlayerKeys';
import { usePlayerNav } from './usePlayerNav';

export interface PlayerProps {
  controller: PlayerController;
  flags: PlayerFlags;
  title: string;
  subtitle?: string;
  /** Already-localized warning pill (codec / audio support), or null. */
  warn?: string | null;
  /** Raw chapter data (normalized here). */
  chapters?: Chapter[];
  /** Intro / credits markers (drives skip-intro + credits autoplay). */
  markers?: readonly Marker[];
  /** Storyboard preview tile at a position (null until the sheet is ready). */
  tileAt: (sec: number) => StoryboardTile | null;
  appearance: SubtitleAppearance;
  onAppearance: (next: Partial<SubtitleAppearance>) => void;
  subtitleGen: SubtitleGenBundle;
  /** "À suivre" data (§10): next episodes + recommendations. */
  upNext: UpNextData;
  /** Play an up-next card (recommendation / next episode from the sheet). */
  onPlayItem?: (item: UpNextItem) => void;
  /** Next episode for the credits autoplay + the cluster next button (§11). */
  onPlayNext?: () => void;
  nextTitle?: CreditsCardItem | null;
  /** Skip-intro window (§13). */
  intro?: { active: boolean; onSkip: () => void };
  /** The video surface (an in-page <video> or a native-plane placeholder). */
  surface: ReactNode;
  /** Blocking admin-stop overlay (locks the transport when present). */
  terminated?: ReactNode;
  /** Floating toasts (resume prompt, etc.). */
  children?: ReactNode;
  /** The element that goes fullscreen on web (the player root). */
  rootRef?: React.Ref<HTMLDivElement>;
  onClose: () => void;
}

function initialSettingsView(overlay: string | null): 'audio' | 'subtitles' | 'menu' {
  if (overlay === 'audio') return 'audio';
  if (overlay === 'subtitles') return 'subtitles';
  return 'menu';
}

// The stage scales/translates (transform-origin + transform) for a smooth shrink:
// settings -> a rounded card on the left; PiP -> a bottom-right window. Native TV
// planes can't be transformed, so those never shrink (settingsShrink stays false).
function stageTransformFor(pipOpen: boolean, settingsShrink: boolean): CSSProperties {
  if (pipOpen) {
    return {
      transformOrigin: '100% 100%',
      transform: 'translate(-24px,-24px) scale(0.2)',
      borderRadius: 18,
    };
  }
  if (settingsShrink) {
    return {
      transformOrigin: '0 50%',
      transform: 'translate(3vw,0) scale(0.5)',
      borderRadius: 22,
    };
  }
  return { transformOrigin: '0 50%', transform: 'none', borderRadius: 0 };
}

/** Derived chrome-visibility flags, kept out of the component to stay flat. The
 * video only shrinks into a card for an IN-PAGE surface; native planes just get
 * the panel slid over them. */
function deriveChrome(
  nav: ReturnType<typeof usePlayerNav>,
  c: PlayerController,
  props: Readonly<PlayerProps>,
  pipOpen: boolean,
) {
  const settingsOpen =
    nav.overlay === 'settings' || nav.overlay === 'audio' || nav.overlay === 'subtitles';
  const sheetOpen = nav.overlay === 'sheet';
  const settingsShrink = settingsOpen && c.surface === 'video';
  const shrunk = settingsShrink || pipOpen;
  const hasUpNext = props.upNext.nextEpisodes.length + props.upNext.recommendations.length > 0;
  const peekVisible = nav.revealed && hasUpNext && !shrunk && !nav.overlay;
  const chromeShown = nav.revealed && !nav.overlay && !pipOpen;
  return { settingsOpen, sheetOpen, settingsShrink, shrunk, peekVisible, chromeShown };
}

/** Credits card key routing: Left/Right swap Play/Cancel focus, OK fires the
 * focused one, Back cancels. Returns whether the key was consumed. */
function handleCreditsKey(
  key: RemoteKey,
  focus: 'play' | 'cancel',
  setFocus: Dispatch<SetStateAction<'play' | 'cancel'>>,
  onPlay: () => void,
  onCancel: () => void,
): boolean {
  if (key === 'Left' || key === 'Right') {
    setFocus((f) => (f === 'play' ? 'cancel' : 'play'));
    return true;
  }
  if (key === 'Enter') {
    if (focus === 'play') onPlay();
    else onCancel();
    return true;
  }
  if (key === 'Back') {
    onCancel();
    return true;
  }
  return false;
}

/**
 * The unified player chrome (§14): one component for web + TV. It owns the nav
 * machine, the keyboard router, the credits autoplay and the settings / PiP
 * video transforms, and composes every surface (top bar, chapter bar, control
 * cluster, settings panel, up-next sheet, subtitle renderer, overlays). The
 * platform provides a {@link PlayerController} + feature flags; nothing here
 * talks to an engine directly.
 */
export function Player(props: Readonly<PlayerProps>) {
  useEffect(injectKeyframes, []);
  const { controller: c, flags } = props;
  const t = useT();
  const locale = useLocale();

  const [statsOn, setStatsOn] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const panelRef = useRef<PanelHandle>(null);
  const locked = Boolean(props.terminated);

  const chapters = useMemo(
    () => normalizeChapters(props.chapters, c.dur * 1000),
    [props.chapters, c.dur],
  );
  const shown = c.seekPreview ?? c.cur;
  const curChapter = currentChapter(chapters, shown * 1000);

  const credits = usePlayerCredits({
    markers: props.markers,
    dur: c.dur,
    cur: c.cur,
    seeking: c.seekPreview != null,
    endedNonce: c.endedNonce,
    hasNext: Boolean(props.onPlayNext),
    onAdvance: () => props.onPlayNext?.(),
  });
  const [creditsFocus, setCreditsFocus] = useState<'play' | 'cancel'>('play');
  useEffect(() => {
    if (credits.show) setCreditsFocus('play');
  }, [credits.show]);

  const nav = usePlayerNav(flags, c.playing, {
    togglePlay: c.togglePlay,
    seekNudge: (d) => c.skip(d * 10),
    onNext: () => props.onPlayNext?.(),
    hasNext: Boolean(props.onPlayNext),
    volumeNudge: (d) => c.setVolume(Math.max(0, Math.min(1, c.volume + d * 0.05))),
    toggleMute: c.toggleMute,
    togglePip: () => setPipOpen((p) => !p),
    toggleFullscreen: c.toggleFullscreen,
    onExit: props.onClose,
  });

  const creditsKey = (key: RemoteKey): boolean =>
    handleCreditsKey(
      key,
      creditsFocus,
      setCreditsFocus,
      () => props.onPlayNext?.(),
      credits.cancel,
    );

  usePlayerKeys({
    nav,
    controller: c,
    flags,
    panelRef,
    locked,
    intro: props.intro,
    credits: { active: credits.show, onKey: creditsKey },
  });

  const { settingsOpen, sheetOpen, settingsShrink, shrunk, peekVisible, chromeShown } =
    deriveChrome(nav, c, props, pipOpen);
  const initialView = initialSettingsView(nav.overlay);
  // Subtitles live inside the stage, so they scale WITH the video (stay in the
  // card, §5).
  const stage = stageTransformFor(pipOpen, settingsShrink);
  const endsAt = c.dur ? endsAtClock(Math.max(0, c.dur - c.cur) * 1000, locale) : '';
  // The top bar + transport hide while a panel / PiP owns the screen, and whenever
  // the chrome auto-hides.
  const chromeFade = chromeShown ? 'opacity-100' : 'pointer-events-none opacity-0';

  return (
    <div
      ref={props.rootRef}
      className={`fixed inset-0 z-60 ${c.surface === 'video' ? 'bg-black' : 'bg-transparent'} ${nav.revealed ? '' : 'cursor-none'}`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') nav.poke();
      }}
    >
      {/* stage: video + subtitles, transformed together for settings / PiP. The
          click / key pair is a pointer convenience (toggle play, double-click
          fullscreen); D-pad control still flows through usePlayerKeys, so the
          element handler stops propagation to avoid a double toggle when focused. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={c.playing ? t('player.pause') : t('player.play')}
        className={`absolute inset-0 z-[2] overflow-hidden transition-[transform,border-radius,box-shadow] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${shrunk ? 'bg-black shadow-pop' : 'bg-transparent'}`}
        style={stage}
        onClick={() => {
          if (!locked) {
            nav.poke();
            c.togglePlay();
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !locked) {
            e.preventDefault();
            e.stopPropagation();
            nav.poke();
            c.togglePlay();
          }
        }}
        onDoubleClick={() => flags.fullscreen && c.toggleFullscreen()}
      >
        {props.surface}
        <SubtitleRenderer
          positionSec={c.cur}
          playing={c.playing}
          subtitles={c.subtitles}
          activeIndex={c.subtitleIndex}
          appearance={props.appearance}
          raised={nav.revealed && !pipOpen}
        />
        {/* Buffering spinner lives INSIDE the stage so it shrinks with the video
            into the settings card / PiP window (not floating over the full page). */}
        {c.waiting && !locked ? (
          <div className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center">
            <div className="h-14 w-14 rounded-full border-[3px] border-[rgba(255,255,255,0.2)] border-t-accent [animation:kpl-spin_0.9s_linear_infinite]" />
          </div>
        ) : null}
      </div>

      {/* PiP: dim the rest + mini controls over the floating video */}
      {pipOpen ? (
        <>
          <div className="absolute inset-0 z-[1] bg-[rgba(0,0,0,0.6)]" />
          <PipControls
            playing={c.playing}
            title={props.title}
            subtitle={props.subtitle}
            onBack10={() => c.skip(-10)}
            onTogglePlay={c.togglePlay}
            onExpand={() => setPipOpen(false)}
            onClose={props.onClose}
            playLabel={c.playing ? t('player.pause') : t('player.play')}
            expandLabel={t('player.pipExpand')}
            closeLabel={t('common.close')}
          />
        </>
      ) : null}

      {/* skip intro (§13) */}
      {props.intro ? (
        <SkipIntroButton
          visible={props.intro.active}
          focused={props.intro.active && !nav.overlay && !credits.show}
          onSkip={props.intro.onSkip}
        />
      ) : null}

      {/* credits autoplay (§11) */}
      {credits.show && props.nextTitle ? (
        <CreditsCard
          item={props.nextTitle}
          secondsLeft={credits.secondsLeft}
          total={credits.total}
          playFocused={creditsFocus === 'play'}
          cancelFocused={creditsFocus === 'cancel'}
          onPlay={() => props.onPlayNext?.()}
          onCancel={credits.cancel}
        />
      ) : null}

      {/* stats (§9) */}
      {statsOn ? <StatsPanel controller={c} onClose={() => setStatsOn(false)} /> : null}

      {/* top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 transition-opacity duration-350 ${chromeFade}`}
      >
        <TopBar
          title={props.title}
          subtitle={props.subtitle}
          warn={props.warn}
          onBack={props.onClose}
        />
      </div>

      {/* up-next sheet (peek + expand, §10) */}
      <UpNextSheet
        ref={sheetOpen ? panelRef : null}
        data={props.upNext}
        open={sheetOpen}
        revealed={peekVisible || sheetOpen}
        onOpen={() => nav.openOverlay('sheet')}
        onClose={() => nav.closeOverlay()}
        onPlay={(item) => props.onPlayItem?.(item)}
      />

      {/* bottom chrome: chapter bar + control cluster */}
      <div
        className={`absolute inset-x-0 z-[15] bg-[linear-gradient(0deg,rgba(0,0,0,0.82),transparent)] px-[34px] pt-20 pb-7 transition-[bottom,opacity] duration-300 ${chromeFade}`}
        style={{ bottom: peekVisible ? 118 : 0 }}
      >
        <ChapterProgressBar
          cur={c.cur}
          dur={c.dur}
          bufEnd={c.bufEnd}
          seekPreview={c.seekPreview}
          chapters={chapters}
          tileAt={props.tileAt}
          focused={nav.zone === 'progress'}
          elapsed={fmtTime(shown)}
          chapterLabel={curChapter?.title || undefined}
          total={fmtTime(c.dur)}
          endsAt={endsAt ? t('content.endsAtShort', { time: endsAt }) : ''}
          onScrub={c.scrubPreview}
          onScrubCommit={c.scrubCommit}
        />
        <ControlCluster
          controls={nav.controls}
          focused={nav.focusedControl}
          playing={c.playing}
          muted={c.muted}
          volume={c.volume}
          pipActive={pipOpen}
          fullscreen={c.fullscreen}
          onActivate={nav.activate}
          onFocus={nav.focusControl}
          onVolume={c.setVolume}
        />
      </div>

      {/* settings / audio / subtitles panel (§5) */}
      {settingsOpen ? (
        <SettingsPanel
          ref={panelRef}
          initialView={initialView}
          controller={c}
          appearance={props.appearance}
          onAppearance={props.onAppearance}
          statsOn={statsOn}
          onToggleStats={() => setStatsOn((s) => !s)}
          subtitleGen={props.subtitleGen}
          onClose={() => nav.closeOverlay()}
        />
      ) : null}

      {props.terminated}
      {props.children}
    </div>
  );
}

/** Mini controls overlaid on the bottom-right floating video during PiP (§12). */
function PipControls({
  playing,
  title,
  subtitle,
  onBack10,
  onTogglePlay,
  onExpand,
  onClose,
  playLabel,
  expandLabel,
  closeLabel,
}: Readonly<{
  playing: boolean;
  title: string;
  subtitle?: string;
  onBack10: () => void;
  onTogglePlay: () => void;
  onExpand: () => void;
  onClose: () => void;
  playLabel: string;
  expandLabel: string;
  closeLabel: string;
}>) {
  return (
    <div className="absolute right-6 bottom-6 z-[3] h-[216px] w-96 overflow-hidden rounded-[18px]">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2.5 p-3">
        <div className="min-w-0">
          <div className="truncate font-sans text-[15px] font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            {title}
          </div>
          {subtitle ? (
            <div className="truncate font-sans text-[12px] font-semibold text-[rgba(255,255,255,0.78)] [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
              {subtitle}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(0,0,0,0.55)] text-white outline-none"
        >
          <IconFullscreenExit size={16} />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-[22px] bg-[linear-gradient(0deg,rgba(0,0,0,0.6),transparent)] p-4">
        <PipBtn label="10" onClick={onBack10}>
          <IconBack10 size={18} />
        </PipBtn>
        <button
          type="button"
          aria-label={playLabel}
          onClick={onTogglePlay}
          className="flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full border-none bg-accent text-accent-ink outline-none"
        >
          {playing ? <IconPause size={21} /> : <IconPlay size={23} />}
        </button>
        <PipBtn label={expandLabel} onClick={onExpand}>
          <IconFullscreenExit size={18} />
        </PipBtn>
      </div>
    </div>
  );
}

function PipBtn({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(0,0,0,0.5)] text-white outline-none"
    >
      {children}
    </button>
  );
}
