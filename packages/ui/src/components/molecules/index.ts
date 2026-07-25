// The MOLECULES: primitives arranged into a shape the design names.
//
// A molecule composes primitives and owns an arrangement, not a behaviour: the
// scrim over a poster, the glyph well on a settings row, the fact that a field's
// error replaces its hint. It may know the shape of the data it lays out (a
// title, a progress fraction) but never where that data came from.
//
// The test for adding one: has this arrangement now been written twice?

export type { CategoryTileProps, CategoryTileSize } from './category-tile';
export { CategoryTile, categoryTileVariants } from './category-tile';
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
export type { OtpFieldProps, OtpSize, OtpSlot } from './otp-field';
export {
  OtpField,
  otpVariants,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from './otp-field';
export type { PinFieldProps } from './pin-field';
export { PinField } from './pin-field';
export type { PosterCardProps } from './poster-card';
export { POSTER_SCRIM, PosterCard } from './poster-card';
export type { SectionProps } from './section';
export { Section } from './section';
