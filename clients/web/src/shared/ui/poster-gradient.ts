import { hueFromString } from '@kroma/core';

/** A deterministic poster stand-in for a title with no artwork: the same string
 *  always draws the same two-tone gradient, so a grid stays stable across
 *  reloads. Matches the design's `posterGrad`. */
export function posterGradient(title: string): string {
  const h = hueFromString(title);
  return `radial-gradient(120% 90% at 30% 16%, hsla(${(h + 22) % 360},60%,46%,.5), transparent 62%), linear-gradient(155deg, hsl(${h} 42% 27%), hsl(${(h + 30) % 360} 48% 10%))`;
}
