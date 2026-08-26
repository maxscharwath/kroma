import { cssRef } from '../core/tokens/css-var.ts';
import { atMedia, rule, type SheetEntry } from './sheet.ts';

export const PAGE: readonly SheetEntry[] = [
  rule(['html', 'body', '#root'], { height: '100%' }),
  // The root, not just the body: the overscroll gutter and the canvas behind a
  // short page are painted from here.
  rule('html', { background: cssRef('bg'), colorScheme: 'dark' }),
  rule('[data-theme="light"]', { colorScheme: 'light' }),
  atMedia('(prefers-color-scheme: light)', [
    rule('html:not([data-theme])', { colorScheme: 'light' }),
  ]),
  rule('body', {
    margin: 0,
    background: cssRef('bg'),
    color: cssRef('text'),
    font: 'var(--type-body)',
    WebkitFontSmoothing: 'antialiased',
    textRendering: 'optimizeLegibility',
    overflowX: 'hidden',
  }),
  rule('::selection', { background: cssRef('accentSoft'), color: cssRef('text') }),
  // The kit's own controls paint their focus (see <Focusable>), so there is no
  // blanket ring here: one rectangle for a round avatar, a rounded card and a
  // stretched row drew the wrong shape on all three, and it outranked the coats
  // a control had chosen for itself.
  rule(['input:focus-visible', 'textarea:focus-visible'], { boxShadow: 'none' }),
  // Fluid, unlayered so they beat the token defaults, which are TV constants.
  rule(':root', {
    '--gutter-web': 'clamp(1rem, 4vw, 3.5rem)',
    '--card-w': 'clamp(8.25rem, 30vw, 13rem)',
  }),
  rule('*', {
    scrollbarColor: `${cssRef('borderStrong')} transparent`,
    scrollbarWidth: 'thin',
  }),
  rule('::-webkit-scrollbar', { width: '10px', height: '10px' }),
  rule('::-webkit-scrollbar-track', { background: 'transparent' }),
  rule('::-webkit-scrollbar-thumb', {
    backgroundClip: 'padding-box',
    border: '3px solid transparent',
    borderRadius: '999px',
    backgroundColor: cssRef('borderStrong'),
  }),
  rule('::-webkit-scrollbar-thumb:hover', { backgroundColor: cssRef('textDim') }),
  rule('::-webkit-scrollbar-corner', { background: 'transparent' }),
];
