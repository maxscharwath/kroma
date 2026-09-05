# Compiled styles

A browser build compiles the kit's static style declarations ahead of time,
the way StyleX does: every property of a declaration becomes one atomic class
in a static stylesheet, and the renderer merges classes per property at render.
What runs in the browser is a lookup and a string join, never a resolver.
React Native is not touched: Metro never runs the plugin, and the same source
resolves at runtime there exactly as it did.

Three halves:

| Half | Where | Job |
| --- | --- | --- |
| build | `packages/ui/vite/atomic/` | evaluates a declaration statically, resolves it through the engine, compiles it, rewrites the call, collects the rules |
| runtime | `src/core/atomic/` | what a compiled module imports: the leaf the build writes, the merge a recipe runs, the dev server's injector |
| renderer | `patches/react-native-web@0.21.2.patch` | react-native-web compiles a static style to its classes and inserts nothing |

## What a build does

`kromaUI()` carries the `kroma-atomic` plugin. For every workspace source
module it sees, the plugin looks for the kit's `styles`, `style`, `sv` and
`svFor` bindings and reads each declaration they are handed without running
the module: literals, the module's own constants, arithmetic on them, spreads,
`as const`, and a constant imported from another workspace file through
`#ui/`, `#tv/`, `#web/`, a relative path, `@kroma/ui/tokens` or
`@kroma/ui/kit`, re-exports followed. A value it reads goes through the same
`split()` and `normalize()` the runtime uses, under a theme whose colours and
shadows are the custom properties the browser reads, then through
react-native-web's own atomic compiler for its rules. The classes a build
emits are therefore the classes the runtime mints for the same value, and the
two never disagree about a rule.

The declaration is then rewritten in place as the longhands it resolved to:

```ts
const s = styles({ row: { row: true, gap: 6 } });
// becomes
const s = styles({ row: __kromaStatic({ flexDirection: 'row', gap: 6 }) });
```

and the rules land in the token stylesheet the shell already loads
(`virtual:kroma*.css` or `@import "@kroma/ui/css"`), after everything
react-native-web injects at runtime, so a compiled class outranks the reset the
renderer gives every view. A build that loads no token sheet is warned and
paints its compiled styles with nothing.

A `styles()` set compiles per entry: the entries the reader cannot see stay as
written and resolve at runtime beside the compiled ones. A recipe compiles per
slot, whole or not at all, because a slot's layers are then merged without
resolving them again; a slot `svFor` types as anything but `StyleDecl` feeds a
component's props and stays as written. What stays on the runtime today: a
value stated per breakpoint, a call (`keyRowWidth(...)`, `color(...)` inside a
declaration), anything bound at render time. `KROMA_ATOMIC_REPORT=1` prints
every declaration left behind and why; a build's summary counts them.
`KROMA_ATOMIC=0` turns the compiler off for one build or dev server, which is
how to tell a compiler fault from a runtime one.

## What a compiled leaf is

`staticStyle(longhands, states?)` is the resolved declaration itself, frozen,
carrying a non-enumerable `$$static` mark and, for a recipe layer, its
`_hover` / `_focus` / `_press` / `_disabled` coats under `$$states`, each a
static leaf of its own. The renderer registers it exactly as it registers a
style compiled at runtime: the same hashing, the same classes, the same cache
hit on every render. Only the rule insertion is skipped, because the sheet
already holds them. That is the whole patch, one hunk in `StyleSheet.create`.

Because the leaf is the longhands, nothing downstream changes: a spread, a key
walk, `StyleSheet.flatten`, `<Text>`'s line-height fix, `<Frost>`'s corner and
the renderer's own `<Image>` reading `resizeMode` all see what they always saw.
A recipe whose slot is static merges its cascade with `mergeStatic`, last wins
per property, into a leaf registered the same way, cached per variant
combination as before.

## Themes

Colour and elevation go through the cascade, as they already did on a browser:
a compiled rule says `var(--kroma-accent)`, and `applyTheme` or a
`[data-theme]` swap repaints it for free. Radius, families and type roles are
literals at build time, as they are literals at runtime today. The difference
is what happens to a theme that restates one of those: a runtime-resolved
declaration rebuilds on `setTheme`, a compiled one keeps the built-in value.
No shell of ours ships such a theme; a kit consumer that does can turn the
compiler off with `kromaUI({ atomic: false })`.

## The dev server

A dev server writes no sheet, so each compiled module injects its own rules as
it loads, into one `<style data-kroma-atomic>` per priority group, in group
order. The shipped build and the dev page therefore paint the same classes
from different places. After the renderer patch first lands, a dev server with
a warm optimizer cache still serves the unpatched copy: start it once with
`--force`.

## What the engine owes the plugin

The plugin runs in the build process, loaded by Node itself, so the engine's
pure core has to load there too. That is why `breakpoint-cascade.ts`,
`normalize.ts` and `shorthand-resolve.ts` read no store and import no
React Native, why every import on that path is spelled `#ui/...` rather than
`./...` (Node cannot resolve an extensionless relative import, and the
package's `imports` map carries a `node` condition that appends the extension
for `#ui/*` while the browser targets keep resolving a `.web` twin), and why a
class there has no parameter properties: Node strips types, it does not
compile them.

## Inline styles

A class is a class only for a style the renderer registered. Two habits put a
style on the element inline instead, and both are gone from the kit:

- a style written as a plain object (`const HAND = { cursor: 'pointer' }`)
  rather than declared with `styles()`. Declared, it is registered, compiled
  ahead of time like any declaration, and shared by every control wearing it.
- a style array flattened with `StyleSheet.flatten` before it reaches the
  element. The result is a fresh object nothing registered. `<Focusable>` did
  this on the browser to satisfy the navigator's type, and painted every
  control inline; it keeps the array now.

A glyph on the browser is a DOM `<svg>` react-native-web never renders, so
`<Icon>` asks the resolver for the classes its registered style compiles to
and hands the element those. What legitimately stays inline is a value only a
render knows: a measured width, an animated transform, a colour picked at
runtime. On the workbench's button page that is 13 elements of 181, down from
116.

A test reads a control's paint with `declared(el, property)` from
`@kroma/ui/testing`, which follows the classes into the stylesheets, and asks
for the ring with `wearsRing(el)`; `el.style` reads nothing of a class, and
jsdom's computed style drops `z-index` and every `var()`.

## Not compiled yet

`<Box>` props resolve at render as before. A value stated per breakpoint stays
on the runtime; compiling it means one class per step under a `data-` attribute
the breakpoint store writes on the root, and is the next step. Interaction
states are still resolved by the recipe from the state `<Focusable>` passes it,
merging static coats; attribute selectors would let the browser do that.
