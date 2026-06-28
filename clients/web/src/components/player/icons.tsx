// Inline player icons — stroke/fill use currentColor so Tailwind text-* controls them.
type P = { size?: number };

function S({ size = 22, children, fill = false }: { size?: number; children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconPlay = ({ size }: P) => (
  <S size={size} fill>
    <path d="M7 4v16l13-8z" />
  </S>
);
export const IconPause = ({ size }: P) => (
  <S size={size} fill>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </S>
);
export const IconBack10 = ({ size }: P) => (
  <S size={size}>
    <path d="M11 7 6 12l5 5M18 7l-5 5 5 5" />
  </S>
);
export const IconFwd10 = ({ size }: P) => (
  <S size={size}>
    <path d="m13 7 5 5-5 5M6 7l5 5-5 5" />
  </S>
);
export const IconVolume = ({ size }: P) => (
  <S size={size}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
  </S>
);
export const IconMute = ({ size }: P) => (
  <S size={size}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </S>
);
export const IconFullscreen = ({ size }: P) => (
  <S size={size}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </S>
);
export const IconFullscreenExit = ({ size }: P) => (
  <S size={size}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </S>
);
export const IconPip = ({ size }: P) => (
  <S size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
  </S>
);
export const IconBack = ({ size }: P) => (
  <S size={size}>
    <path d="M15 5l-7 7 7 7" />
  </S>
);
export const IconTracks = ({ size = 18 }: P) => (
  <S size={size}>
    <path d="M3 5h18M3 12h18M3 19h12" />
    <circle cx="20" cy="19" r="1.6" fill="currentColor" stroke="none" />
  </S>
);
export const IconStats = ({ size }: P) => (
  <S size={size}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </S>
);
export const IconCheck = ({ size = 18 }: P) => (
  <S size={size}>
    <path d="M20 6 9 17l-5-5" />
  </S>
);
export const IconClose = ({ size = 18 }: P) => (
  <S size={size}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
