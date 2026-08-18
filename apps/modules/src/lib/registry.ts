import {
  buildDescriptor,
  buildIndex,
  buildModuleRecord,
  jsonSchema,
  SCHEMA_NAMES,
  type SchemaName,
} from '@kroma/module-tools/registry';
import type { ModuleEntry } from '#site/catalog';
import { releaseHistory } from '#site/lib/releases';
import { type Env, jsonResponse, loadCatalog } from '#site/lib/source';

const REGISTRY_NAME = 'KROMA modules';

const MODULE_ROUTE = /^\/m\/([^/]+)\.json$/;

const SCHEMA_ROUTE = /^\/schema\/([^/]+)\.json$/;

const schemaName = (path: string): SchemaName | undefined =>
  SCHEMA_NAMES.find((name) => SCHEMA_ROUTE.exec(path)?.[1] === name);

/** The RFC-110 paths this registry answers, off the same merged catalog the
 *  legacy `/modules.json` serves. */
export function isRegistryPath(path: string): boolean {
  return (
    path === '/registry.json' ||
    path === '/index.json' ||
    MODULE_ROUTE.test(path) ||
    schemaName(path) !== undefined
  );
}

// The catalog's own schema keeps a nullable url/size so a malformed upstream
// entry cannot reach the site; an artifact with no https url is not one a
// registry may offer at all.
function described(m: ModuleEntry) {
  return {
    ...m,
    artifacts: (m.artifacts ?? []).flatMap((a) =>
      a.url
        ? [
            {
              target: a.target,
              url: a.url,
              size: a.size ?? 0,
              sha256: a.sha256,
              contentHash: a.contentHash,
            },
          ]
        : [],
    ),
  };
}

/** Serves what [`isRegistryPath`] matches. `null` when the path is not one; a
 *  503 when the catalog cannot be read, because an empty registry and an
 *  unreachable one must not look the same to an installer. */
export async function registryResponse(
  path: string,
  origin: string,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response | null> {
  if (!isRegistryPath(path)) return null;

  // The spec is derived from the schemas this registry emits with, so it is
  // served without reading the catalog at all.
  const schema = schemaName(path);
  if (schema) return jsonResponse(JSON.stringify(jsonSchema(schema)), 86400);

  const body = await loadCatalog(env, waitUntil);
  const { parseCatalog } = await import('#site/catalog');
  const catalog = body ? parseCatalog(body) : null;
  if (!catalog) {
    return jsonResponse(JSON.stringify({ error: 'catalog unavailable' }), 60, 503);
  }
  const modules = catalog.modules.map(described);

  const one = MODULE_ROUTE.exec(path);
  if (one?.[1]) {
    const id = decodeURIComponent(one[1]);
    const found = modules.find((m) => m.id === id);
    if (!found) return jsonResponse(JSON.stringify({ error: 'no such module' }), 60, 404);
    // Only the full record carries history: the catalog names the current
    // version of each module, the releases hold every version ever cut.
    const known = (await releaseHistory(env, waitUntil))[id];
    return jsonResponse(JSON.stringify(buildModuleRecord(found, known)), 300);
  }
  const document =
    path === '/registry.json'
      ? buildDescriptor(REGISTRY_NAME, origin, modules)
      : buildIndex(modules);
  return jsonResponse(JSON.stringify(document), 300);
}
