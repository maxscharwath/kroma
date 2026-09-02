import type { TVars } from './types';

/**
 * The seam that makes this package typed without a generic at every call site.
 *
 * A project augments it once and from then on {@link Locale}, {@link MessageKey}
 * and {@link Translate} are its own everywhere they are imported. It can be
 * written by hand next to a `createI18n` call:
 *
 * ```ts
 * declare module '@kroma/i18n' {
 *   interface Register extends InferRegister<typeof i18n> {}
 * }
 * ```
 *
 * or, for catalogs kept one file per namespace, by the `@kroma/i18n/vite`
 * plugin, which declares `locale` here and one entry per namespace in
 * {@link Namespaces} from the files it finds.
 *
 * Left alone it stays empty and the types widen to `string`, so the package is
 * usable before it is configured and a consumer that never augments it still
 * compiles.
 */
// biome-ignore lint/suspicious/noEmptyInterface: the augmentation target; a type alias cannot be reopened.
export interface Register {}

/** One entry per namespace: the default locale's messages under the
 *  namespace's name. Filled by the Vite plugin, never by hand. */
// biome-ignore lint/suspicious/noEmptyInterface: the augmentation target; a type alias cannot be reopened.
export interface Namespaces {}

export type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
  u: infer I,
) => void
  ? I
  : never;

type Registered = keyof Namespaces extends never
  ? Record<string, string>
  : UnionToIntersection<Namespaces[keyof Namespaces]>;

/** The locales the project registered, or `string` before it registers any. */
export type Locale = Register extends { locale: infer L extends string } ? L : string;

/** The message map the project registered: `Register.messages` when it wrote
 *  one, else every namespace in {@link Namespaces} folded into one map. */
export type Messages = Register extends { messages: infer M extends Record<string, string> }
  ? M
  : Registered;

/** Every key the default catalog declares, which is the catalog that has to be
 *  complete because it is the one every other locale falls back to. */
export type MessageKey = keyof Messages & string;

/** A namespace name, as `load` accepts it: every one the plugin found. */
export type Namespace = keyof Namespaces extends never ? string : keyof Namespaces & string;

/** A translation function bound to one locale. */
export type Translate = (key: MessageKey, vars?: TVars) => string;
