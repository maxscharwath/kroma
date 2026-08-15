import { resolveBlurb, type SiteModule } from '#site/lib/modules';
import { m } from '#site/paraglide/messages';

// The site's own copy per official module, so the French page reads French
// rather than the catalog's English description.
const BLURBS: Record<string, () => string> = {
  'tv.kroma.acquisition': m.modules_item_acquisition,
  'tv.kroma.engine.qbittorrent': m.modules_item_qbittorrent,
  'tv.kroma.engine.transmission': m.modules_item_transmission,
  'tv.kroma.indexer': m.modules_item_indexer,
  'tv.kroma.mdns': m.modules_item_mdns,
  'tv.kroma.remote': m.modules_item_remote,
  'tv.kroma.scene': m.modules_item_scene,
  'tv.kroma.torrents': m.modules_item_torrents,
  'tv.kroma.torznab': m.modules_item_torznab,
  'tv.kroma.vector': m.modules_item_vector,
  'tv.kroma.vpn': m.modules_item_vpn,
  'tv.kroma.whisper': m.modules_item_whisper,
};

export interface ModuleCardProps {
  mod: SiteModule;
}

/** One catalog entry: its icon, name, version, and what it needs to be useful. */
export function ModuleCard({ mod }: Readonly<ModuleCardProps>) {
  const needs = [...mod.requires, ...mod.dependsOn.map((id) => id.replace(/^tv\.kroma\./, ''))];

  return (
    <div className="flex gap-4 bg-surface-1/40 p-5 transition-colors duration-200 hover:bg-surface-1">
      {/* Inline data URI from the catalog, so the card paints with no extra request. */}
      {mod.icon && (
        <img
          src={mod.icon}
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="font-display text-[0.98rem] font-bold leading-snug text-text">
            {mod.name}
          </h3>
          {mod.version && <span className="font-mono text-[0.68rem] text-dim">v{mod.version}</span>}
          {mod.library && (
            <span className="rounded-full border border-border-strong px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-dim">
              {m.modules_catalog_library()}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-sm leading-relaxed text-muted">{resolveBlurb(BLURBS, mod)}</p>

        {needs.length > 0 && (
          <p className="mt-2.5 font-mono text-[0.68rem] text-dim">
            {m.modules_catalog_needs()} {needs.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
