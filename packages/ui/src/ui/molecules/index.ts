// The MOLECULES: primitives arranged into a shape the design names.
//
// A molecule composes primitives and owns an arrangement, not a behaviour: the
// scrim over a poster, the glyph well on a settings row, the fact that a field's
// error replaces its hint. It may know the shape of the data it lays out (a
// title, a progress fraction) but never where that data came from.
//
// The test for adding one: has this arrangement now been written twice?

export type { ConfirmDialogProps, DialogProps } from './dialog';
export { ConfirmDialog, Dialog, DialogFooter } from './dialog';
export type { EmptyStateProps } from './empty-state';
export { EmptyState } from './empty-state';
export type { FieldProps } from './field';
export { Field } from './field';
export type { HintKey, HintProps } from './hint';
export { HINT_KEYS, Hint } from './hint';
export type { ListRowProps, ListRowSize } from './list-row';
export { ListRow, listRowVariants } from './list-row';
export type { MediaCardProps } from './media-card';
export { CARD_SCRIM, MediaCard, tintGradient } from './media-card';
export { PerfHud } from './perf-hud';
export type { PosterCardProps } from './poster-card';
export { POSTER_SCRIM, PosterCard } from './poster-card';
export type { RailProps } from './rail';
export { Rail } from './rail';
export type { SectionProps } from './section';
export { Section } from './section';
export type { VirtualGridProps, VirtualRailProps } from './virtual';
export { VirtualGrid, VirtualRail } from './virtual';
