// The Store section of the admin Modules page: what the configured registry
// offers for THIS server. Installing goes through POST /store/install-id,
// which resolves missing hard dependencies and verifies each download's
// sha256 before unpacking.

import { Image } from '@kroma/admin-kit';
import { Button } from '@kroma/ui/kit';
import { IconSearch } from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';
import { adminApi } from '#web/features/admin/module-api';
import type { RegistryStatus } from '#web/features/admin/module-registries';
import { Card } from '#web/features/admin/ui';
import { InputGroup, InputGroupAddon, InputGroupInput } from '#web/shared/ui/input-group';

/** One catalog entry, enriched server-side (GET /api/admin/store/catalog). */
export interface RegistryModule {
  id: string;
  name: string;
  version: string;
  description?: string;
  library?: boolean;
  icon?: string | null;
  minServer?: string | null;
  url?: string | null;
  size?: number | null;
  sha256?: string | null;
  installedVersion?: string | null;
  updateAvailable?: boolean;
  compatible: boolean;
  reason?: string | null;
  /** Name of the registry this entry came from. */
  source?: string | null;
}

/** The enriched catalog, merged across every configured registry. `error` and
 *  `registryUrl` describe the OFFICIAL registry only (both predate the list and
 *  are kept so an older client still works); `registries` carries the rest. */
export interface StoreCatalog {
  schema: number;
  serverVersion: string;
  target: string;
  registryUrl: string;
  error?: string | null;
  registries?: RegistryStatus[];
  modules: RegistryModule[];
}

/** What POST /store/install-id reports back: everything actually installed,
 *  auto-installed dependencies included, in install order. */
export interface InstallReport {
  requested: string;
  installed: { id: string; name: string; version: string }[];
}

/** Install/update a module (and its missing deps) from the registry. */
export function installFromStore(id: string): Promise<InstallReport> {
  return adminApi<InstallReport>('/store/install-id', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

/** Human summary of an install report: "Installed Acquisition 0.1.0 (+ 2
 *  dependencies: Downloads 0.1.0, Indexers 0.1.0)". */
export function installSummary(report: InstallReport): string {
  const requested = report.installed.find((m) => m.id === report.requested);
  const deps = report.installed.filter((m) => m.id !== report.requested);
  const head = requested ? `Installed ${requested.name} ${requested.version}` : 'Installed';
  if (deps.length === 0) return head;
  const list = deps.map((d) => `${d.name} ${d.version}`).join(', ');
  return `${head} (+ ${deps.length} ${deps.length === 1 ? 'dependency' : 'dependencies'}: ${list})`;
}

function StoreCard({
  m,
  busy,
  onInstall,
}: Readonly<{ m: RegistryModule; busy: boolean; onInstall: (id: string) => void }>) {
  return (
    <Card className="flex items-start gap-3 p-4">
      {m.icon ? (
        <Image src={m.icon} fit="cover" className="mt-0.5 h-9 w-9 shrink-0 rounded-lg" />
      ) : (
        <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-text">{m.name}</span>
          <Button
            variant="outline"
            active
            size="sm"
            label="Install"
            onPress={() => onInstall(m.id)}
            disabled={busy || !m.compatible}
          />
        </div>
        <div className="text-[11px] text-dim">
          {m.id} · v{m.version}
          {m.size ? <> · {Math.trunc(m.size / 1024)} KB</> : null}
          {m.source ? <> · {m.source}</> : null}
        </div>
        {m.description && <p className="mt-1 text-xs text-muted">{m.description}</p>}
        {!m.compatible && m.reason && (
          <p className="mt-1 text-xs font-semibold text-danger">{m.reason}</p>
        )}
      </div>
    </Card>
  );
}

function matches(m: RegistryModule, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.id, m.name, m.description ?? ''].some((s) => s.toLowerCase().includes(q));
}

/** Always visible so the registry state is never a mystery: the merged catalog
 * grid with a search box, or an explanation when nothing could be fetched.
 * Per-registry status lives in the Registries section above. */
export function StoreSection({
  catalog,
  installedIds,
  busy,
  onInstall,
}: Readonly<{
  catalog: StoreCatalog | null | undefined;
  installedIds: Set<string>;
  busy: boolean;
  onInstall: (id: string) => void;
}>) {
  const [query, setQuery] = useState('');
  if (!catalog) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-dim">Registry</h2>
        <p className="text-xs text-muted">Loading the module registry...</p>
      </section>
    );
  }
  // Only a total blackout is an error here: with several registries configured,
  // one unreachable host still leaves a usable catalog, and its failure is
  // already reported against that registry in the Registries section.
  if (catalog.modules.length === 0 && catalog.error) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-dim">Registry</h2>
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm font-semibold text-danger">No module catalog could be fetched</p>
          <p className="break-all text-xs text-muted">{catalog.error}</p>
          <p className="text-xs text-muted">
            The default registry is the <code className="text-dim">modules.json</code> attached to
            this project's GitHub Releases; it exists once a release is published (tag{' '}
            <code className="text-dim">vX.Y.Z</code>). Point the Store elsewhere, or add another
            registry, in the Registries section above.
          </p>
        </Card>
      </section>
    );
  }
  const available = catalog.modules.filter((m) => !installedIds.has(m.id));
  const shown = available.filter((m) => matches(m, query));
  let body: ReactNode;
  if (available.length === 0) {
    body = (
      <p className="text-xs text-muted">
        Every module from the registry ({catalog.modules.length}) is installed.
      </p>
    );
  } else if (shown.length === 0) {
    body = <p className="text-xs text-muted">No module matches "{query.trim()}".</p>;
  } else {
    body = (
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((m) => (
          <StoreCard key={m.id} m={m} busy={busy} onInstall={onInstall} />
        ))}
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-dim">
          Available in the registry ({available.length})
        </h2>
        {available.length > 0 && (
          <InputGroup className="h-9 w-64">
            <InputGroupAddon>
              <IconSearch size={15} />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules..."
              className="text-[13px]"
            />
          </InputGroup>
        )}
      </div>
      {body}
    </section>
  );
}
