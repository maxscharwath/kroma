/** One catalog entry, reduced to the language-invariant facts the site renders. */
export interface SiteModule {
  id: string;
  name: string;
  version: string;
  /** English, from the catalog. Site copy is preferred; this is the fallback. */
  description: string | null;
  icon: string | null;
  /** A library module is linked by the sidecars that use it; it runs no process of its own. */
  library: boolean;
  provides: string[];
  requires: string[];
  dependsOn: string[];
}

export interface SiteCatalog {
  generatedAt: string | null;
  modules: SiteModule[];
}

export interface RawEntry {
  id: string;
  name?: string;
  version?: string;
  description?: string | null;
  icon?: string | null;
  library?: boolean | null;
  provides?: { kind: string }[] | null;
  requires?: { kind: string }[] | null;
  dependsOn?: Record<string, string> | string[] | null;
}

export interface RawCatalog {
  generatedAt?: string | null;
  modules: RawEntry[];
}

const kinds = (xs: { kind: string }[] | null | undefined) => [
  ...new Set((xs ?? []).map((x) => x.kind).filter(Boolean)),
];

const depIds = (d: Record<string, string> | string[] | null | undefined) =>
  Array.isArray(d) ? d : Object.keys(d ?? {});

/** The catalog as fetched, reduced to what the site renders and ordered by id. */
export function toSiteCatalog(raw: RawCatalog): SiteCatalog {
  return {
    generatedAt: raw.generatedAt ?? null,
    modules: raw.modules
      .map((e) => ({
        id: e.id,
        name: e.name || e.id,
        version: e.version ?? '',
        description: e.description ?? null,
        icon: e.icon ?? null,
        library: e.library === true,
        provides: kinds(e.provides),
        requires: kinds(e.requires),
        dependsOn: depIds(e.dependsOn),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * The site's own translated one-liner for a module, or the catalog's English
 * description when the site has no copy for it yet, which is what a newly
 * published module gets until its copy lands.
 *
 * The message map is an argument rather than an import: this module has to stay
 * loadable without the Paraglide output, which only exists after a build.
 */
export function resolveBlurb(
  blurbs: Readonly<Record<string, () => string>>,
  mod: Pick<SiteModule, 'id' | 'description'>,
): string {
  return blurbs[mod.id]?.() ?? mod.description ?? '';
}

// The order the site tells the story in: what you acquire with, then what
// carries it, then what enriches it, then what reaches it. Anything unlisted
// keeps its catalog order after these.
const ORDER = [
  'tv.kroma.indexer',
  'tv.kroma.torznab',
  'tv.kroma.torrents',
  'tv.kroma.acquisition',
  'tv.kroma.engine.qbittorrent',
  'tv.kroma.engine.transmission',
  'tv.kroma.vpn',
  'tv.kroma.vector',
  'tv.kroma.whisper',
  'tv.kroma.scene',
  'tv.kroma.remote',
  'tv.kroma.mdns',
];

const rank = (id: string) => {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
};

/** The catalog in the order the page reads, curated first and the rest after. */
export function ordered(modules: readonly SiteModule[]): SiteModule[] {
  return [...modules].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

/** `2026-08-15T13:19:46.343Z` as `2026-08-15`, or null when it is not a date. */
export function catalogDay(generatedAt: string | null): string | null {
  if (!generatedAt) return null;
  const t = Date.parse(generatedAt);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
