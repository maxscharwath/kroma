// Finalizes a dual-bundle TV package after the LEGACY vite build (which runs
// after the modern one - see the shell's package.json):
//
//  1. Post-processes <dist>/legacy/style.css: the kroma-legacy-css shims, then
//     Lightning CSS down-level + minify for the target Chrome floor. Done here,
//     on the emitted file, so the transforms always see the final stylesheet
//     regardless of plugin order.
//
//  2. Rewrites <dist>/index.html into an engine-gated loader: Chrome 99+ (probed
//     through CSSLayerBlockRule) loads the untouched ESM bundle; anything older
//     loads the flattened ES2015 IIFE bundle. One package serves every
//     generation.

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flattenCustomProperties, lowerJs } from '@kroma/bundler/deep-tier';
import { kromaLegacyCss } from '@kroma/bundler/legacy-css';
import { transform } from 'lightningcss';
import postcss from 'postcss';
import type { Plugin } from 'vite';

/** One branch of the engine gate. The last tier carries no probe: it is the
 * fallback every engine below the one above it falls into. */
export interface GateTier {
  dir: string;
  probe?: string;
}

async function downlevelCss(distDir: string, dir: string, chrome: number): Promise<void> {
  const path = join(distDir, dir, 'style.css');
  const raw = readFileSync(path, 'utf8');
  const shimmed = await postcss([kromaLegacyCss()]).process(raw, {
    from: path,
    map: false,
  });
  const { code } = transform({
    filename: 'style.css',
    code: Buffer.from(shimmed.css),
    minify: true,
    targets: { chrome: chrome << 16 },
  });
  writeFileSync(path, code);
}

function rewriteIndexHtml(distDir: string, tiers: GateTier[]): void {
  const path = join(distDir, 'index.html');
  let html = readFileSync(path, 'utf8');
  const js = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html);
  const css = /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/.exec(html);
  if (!js || !css) {
    throw new Error(
      'legacy-finalize: modern <script type=module> / stylesheet not found in dist/index.html',
    );
  }
  // The modulepreloads have to move INSIDE the gate: left in the document
  // they are plain <link>s, so an old engine fetches every modern chunk it
  // cannot run (measured at 1.04 MiB on webOS) before the legacy bundle it
  // needs even starts, silently. Re-emitted below on the modern branch so
  // that tier keeps its head start.
  const preloads = [...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g)].map(
    (m) => m[1],
  );
  // Whitespace AFTER the tag, not before it: a leading `\s*` backtracks through
  // the whole indent run at every position the literal then fails to match.
  html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

  const branches = tiers
    .map((tier) => {
      const open = tier.probe ? `else if (${tier.probe}) {` : 'else {';
      return `        ${open}
          css = './${tier.dir}/style.css';
          src = './${tier.dir}/index.js';
        }`;
    })
    .join('\n');

  // The loader itself must be ES5: it is the one script every engine parses.
  const loader = `<script>
      /* Engine gate, newest first: Chrome 99+ (cascade layers) takes the modern
         ESM bundle, and each older tier claims what the one above it cannot run. */
      (function () {
        var css, src;
        var modern = typeof window.CSSLayerBlockRule !== 'undefined';
        if (modern) {
          css = '${css[1]}';
          src = '${js[1]}';
        }
${branches}
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = css;
        document.head.appendChild(link);
        var script = document.createElement('script');
        if (modern) {
          var pre = ${JSON.stringify(preloads)};
          for (var i = 0; i < pre.length; i++) {
            var l = document.createElement('link');
            l.rel = 'modulepreload';
            l.crossOrigin = '';
            l.href = pre[i];
            document.head.appendChild(l);
          }
          script.type = 'module';
          script.crossOrigin = '';
        }
        script.src = src;
        document.body.appendChild(script);
      })();
    </script>`;
  html = html.replace(js[0], '').replace(css[0], '');
  html = html.replace('</body>', `${loader}\n  </body>`);
  writeFileSync(path, html);
}

// Drops every legacy asset that is byte-for-byte the modern tier's, and
// points the legacy bundle at the one remaining copy: the two tiers are
// separate Vite builds, so each emitted its own copy of the brand intro -
// 7.8 MB, 42% of the whole TV package, duplicated for nothing. Content
// hashing makes this safe and cheap: identical bytes already carry
// identical names.
function dedupeAssets(distDir: string, dir: string): number {
  const legacyAssets = join(distDir, dir, 'assets');
  const modernAssets = join(distDir, 'assets');
  if (!existsSync(legacyAssets) || !existsSync(modernAssets)) return 0;

  let saved = 0;
  const shared: string[] = [];
  for (const name of readdirSync(legacyAssets)) {
    const legacyFile = join(legacyAssets, name);
    const modernFile = join(modernAssets, name);
    if (!existsSync(modernFile)) continue;
    // Size first: it rejects any genuine mismatch for the price of a stat, and
    // the pair here includes an 8 MB video that would otherwise be read twice.
    const size = statSync(legacyFile).size;
    if (statSync(modernFile).size !== size) continue;
    if (!readFileSync(legacyFile).equals(readFileSync(modernFile))) continue;
    saved += size;
    rmSync(legacyFile);
    shared.push(name);
  }
  if (shared.length === 0) return 0;

  // Each file has exactly ONE prefix, because of where its URLs resolve from:
  // the JS against the document (dist/index.html), the stylesheet against itself.
  const rewrite = (file: string, from: string, to: string) => {
    const p = join(distDir, file);
    if (!existsSync(p)) return;
    let text = readFileSync(p, 'utf8');
    for (const name of shared) text = text.split(from + name).join(to + name);
    writeFileSync(p, text);
  };
  rewrite(`${dir}/index.js`, `./${dir}/assets/`, './assets/');
  rewrite(`${dir}/style.css`, './assets/', '../assets/');
  return saved;
}

// The one theme a flattened stylesheet can carry, taken from the shell's own
// <html data-theme>. Cascade-driven theming is what resolving the custom
// properties spends, so the tier has to know which side it is keeping.
function pinnedTheme(distDir: string): string {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  return /<html[^>]*\sdata-theme="([\w-]+)"/.exec(html)?.[1] ?? 'dark';
}

export interface LegacyFinalizeOptions {
  distDir: string;
  chrome: number;
  /** Subdirectory of dist this tier was built into. */
  dir?: string;
  /** Run the Chromium-47 passes: Babel down-level and custom-property flattening. */
  deep?: boolean;
  /** Tiers to write into index.html's gate. Only the last tier built passes this. */
  gate?: GateTier[];
}

/** `distDir` = the shell's absolute dist dir; `chrome` = this tier's floor. */
export function legacyFinalize({
  distDir,
  chrome,
  dir = 'legacy',
  deep = false,
  gate,
}: LegacyFinalizeOptions): Plugin {
  return {
    name: 'kroma-legacy-finalize',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      await downlevelCss(distDir, dir, chrome);
      if (deep) {
        const theme = pinnedTheme(distDir);
        await flattenCustomProperties(join(distDir, dir, 'style.css'), theme);
        await lowerJs(join(distDir, dir, 'index.js'), chrome);
        this.info?.(`[${dir}] lowered to chromium ${chrome}, theme pinned to ${theme}`);
      }
      if (gate) rewriteIndexHtml(distDir, gate);
      const saved = dedupeAssets(distDir, dir);
      if (saved > 0) {
        this.info?.(
          `[${dir}] deduped ${(saved / 1024 / 1024).toFixed(2)} MB shared with the modern tier`,
        );
      }
    },
  };
}
