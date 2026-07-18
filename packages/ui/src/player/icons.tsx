/**
 * Shared player glyphs (@tabler/icons-react), one set for web + TV so the
 * unified chrome renders identical iconography everywhere. Colour flows from
 * `currentColor`; every icon takes an optional `size` (and `stroke` where the
 * outline weight matters).
 */
import {
  IconAdjustmentsHorizontal,
  IconBadge4k,
  IconBadgeCc,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconChevronUp,
  IconClock,
  IconGauge,
  IconMaximize,
  IconMinimize,
  IconPictureInPicture,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconPlayerTrackNextFilled,
  IconRepeat,
  IconRotateClockwise2,
  IconSettings,
  IconSparkles,
  IconTrash,
  IconTypography,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconVolumeOff,
  IconWaveSine,
  IconX,
} from '@tabler/icons-react';

type P = Readonly<{ size?: number; stroke?: number }>;

export const IconPlay = ({ size = 30 }: P) => <IconPlayerPlayFilled size={size} />;
export const IconPause = ({ size = 28 }: P) => <IconPlayerPauseFilled size={size} />;
// The design draws rewind / forward as double-chevrons (the ±10s transport),
// not the circular "10" glyph, so match that.
export const IconBack10 = ({ size = 27, stroke = 1.8 }: P) => (
  <IconChevronsLeft size={size} stroke={stroke} />
);
export const IconFwd10 = ({ size = 27, stroke = 1.8 }: P) => (
  <IconChevronsRight size={size} stroke={stroke} />
);
export const IconNext = ({ size = 24 }: P) => <IconPlayerTrackNextFilled size={size} />;
export const IconVolHigh = ({ size = 22, stroke = 1.8 }: P) => (
  <IconVolume size={size} stroke={stroke} />
);
export const IconVolLow = ({ size = 22, stroke = 1.8 }: P) => (
  <IconVolume2 size={size} stroke={stroke} />
);
export const IconVolMin = ({ size = 22, stroke = 1.8 }: P) => (
  <IconVolume3 size={size} stroke={stroke} />
);
export const IconMute = ({ size = 22, stroke = 1.8 }: P) => (
  <IconVolumeOff size={size} stroke={stroke} />
);
export const IconSubtitles = ({ size = 22, stroke = 1.8 }: P) => (
  <IconBadgeCc size={size} stroke={stroke} />
);
export const IconAudioTrack = ({ size = 22, stroke = 1.8 }: P) => (
  <IconWaveSine size={size} stroke={stroke} />
);
export const IconGear = ({ size = 22, stroke = 1.8 }: P) => (
  <IconSettings size={size} stroke={stroke} />
);
export const IconPip = ({ size = 22, stroke = 1.8 }: P) => (
  <IconPictureInPicture size={size} stroke={stroke} />
);
export const IconFullscreen = ({ size = 22, stroke = 1.8 }: P) => (
  <IconMaximize size={size} stroke={stroke} />
);
export const IconFullscreenExit = ({ size = 22, stroke = 1.8 }: P) => (
  <IconMinimize size={size} stroke={stroke} />
);
export const IconBack = ({ size = 20, stroke = 2 }: P) => (
  <IconChevronLeft size={size} stroke={stroke} />
);
export const IconForward = ({ size = 20, stroke = 2 }: P) => (
  <IconChevronRight size={size} stroke={stroke} />
);
export const IconExpand = ({ size = 22, stroke = 2 }: P) => (
  <IconChevronUp size={size} stroke={stroke} />
);
export const IconCollapse = ({ size = 22, stroke = 2 }: P) => (
  <IconChevronDown size={size} stroke={stroke} />
);
export const IconClose = ({ size = 18, stroke = 1.8 }: P) => <IconX size={size} stroke={stroke} />;
export const IconOk = ({ size = 18, stroke = 2.2 }: P) => <IconCheck size={size} stroke={stroke} />;
export const IconAi = ({ size = 13, stroke = 2 }: P) => (
  <IconSparkles size={size} stroke={stroke} />
);
export const IconDelete = ({ size = 16, stroke = 1.8 }: P) => (
  <IconTrash size={size} stroke={stroke} />
);
export const IconStats = ({ size = 22, stroke = 1.8 }: P) => (
  <IconChartBar size={size} stroke={stroke} />
);
export const IconLoop = ({ size = 22, stroke = 1.8 }: P) => (
  <IconRepeat size={size} stroke={stroke} />
);
// Settings-menu row glyphs (§5): quality / audio-filter / appearance / speed.
export const IconQuality = ({ size = 22, stroke = 1.8 }: P) => (
  <IconBadge4k size={size} stroke={stroke} />
);
export const IconAudioFilter = ({ size = 22, stroke = 1.8 }: P) => (
  <IconAdjustmentsHorizontal size={size} stroke={stroke} />
);
export const IconAppearance = ({ size = 22, stroke = 1.8 }: P) => (
  <IconTypography size={size} stroke={stroke} />
);
export const IconSpeed = ({ size = 22, stroke = 1.8 }: P) => (
  <IconGauge size={size} stroke={stroke} />
);
export const IconStop = ({ size = 52 }: P) => <IconPlayerStopFilled size={size} />;
export const IconEndsAt = ({ size = 15, stroke = 1.8 }: P) => (
  <IconClock size={size} stroke={stroke} />
);
export const IconRestart = ({ size = 18, stroke = 1.8 }: P) => (
  <IconRotateClockwise2 size={size} stroke={stroke} />
);
