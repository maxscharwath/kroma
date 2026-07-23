// The PRIMITIVES: the kit's atoms.
//
// A primitive owns one visual idea and composes nothing but React Native hosts
// (or, at most, another primitive as a leaf). It knows about tokens and about
// focus; it knows nothing about the app. If a component needs to be told what a
// film is, it is not a primitive.

export type { AvatarProps } from './avatar';
export { AVATAR_GRADIENT, AVATAR_GRADIENTS, Avatar, gradientFor, initialsOf } from './avatar';
export type { BadgeProps, BadgeTone } from './badge';
export { Badge, badgeVariants, qualityTone } from './badge';
export type { BoxProps } from './box';
export { Box, Column, Row, Spacer } from './box';
export type { ButtonProps, ButtonSize, ButtonVariant } from './button';
export { Button, buttonVariants } from './button';
export type { ChipProps } from './chip';
export { Chip, chipVariants } from './chip';
export type { DividerProps } from './divider';
export { Divider } from './divider';
export type { FocusableProps, FocusState } from './focusable';
export { Focusable } from './focusable';
export type { GridProps } from './grid';
export { cellWidth, Grid } from './grid';
export type { IconName, IconProps } from './icon';
export { Icon } from './icon';
export type { IconButtonProps } from './icon-button';
export { IconButton, iconButtonVariants } from './icon-button';
export type { ImgProps } from './img';
export { IMG_FADE_MS, Img } from './img';
export type { LogoProps } from './logo';
export { Logo } from './logo';
export type { ProgressProps } from './progress';
export { clamp01, Progress } from './progress';
export type { ProgressRingProps } from './progress-ring';
export { ProgressRing } from './progress-ring';
export type { SkeletonProps } from './skeleton';
export { Skeleton } from './skeleton';
export type { SpinnerProps } from './spinner';
export { Spinner } from './spinner';
export type { SurfacePad, SurfaceProps, SurfaceTone } from './surface';
export { Surface, surfaceVariants } from './surface';
export type { SwitchProps, SwitchSize } from './switch';
export { Switch, switchVariants } from './switch';
export type { TxtProps } from './text';
export { Txt } from './text';
export type { TextFieldProps } from './text-field';
export { TextField } from './text-field';
export type { TvStageProps } from './tv-stage';
export { TvStage } from './tv-stage';
export type { WatchedBadgeProps } from './watched-badge';
export { WatchedBadge } from './watched-badge';
export type { WheelProps } from './wheel';
export { Wheel } from './wheel';
