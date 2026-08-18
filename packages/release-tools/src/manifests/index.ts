// A manifest updater reads and writes the `version` field of one manifest
// format, treating the file as text so formatting, comments and key order
// survive untouched. Projects register their own for exotic formats; the two
// built-ins (TOML for Cargo, JSON for package.json / module.json / any
// `{ "version": ... }` file) cover most repos.

export interface ManifestUpdater {
  read(text: string): string | null;
  write(text: string, version: string): string;
}

// The first top-level `version = "..."` — Cargo's [package] version sits above
// the dependency tables, so the first match is the package's own.
export const cargoUpdater: ManifestUpdater = {
  read: (text) => text.match(/^version[ \t]*=[ \t]*"([^"]+)"/m)?.[1] ?? null,
  write: (text, version) => text.replace(/^(version[ \t]*=[ \t]*")[^"]+(")/m, `$1${version}$2`),
};

// The first `"version": "..."` — package.json and module.json both place it near
// the top of the object.
export const jsonUpdater: ManifestUpdater = {
  read: (text) => text.match(/"version"[ \t]*:[ \t]*"([^"]+)"/)?.[1] ?? null,
  write: (text, version) => text.replace(/("version"[ \t]*:[ \t]*")[^"]+(")/, `$1${version}$2`),
};

const BY_EXTENSION: Record<string, ManifestUpdater> = {
  '.toml': cargoUpdater,
  '.json': jsonUpdater,
};

// Pick an updater by file extension. Extend BY_EXTENSION (or pass an updater
// explicitly) to support a format not covered here.
export function updaterFor(path: string): ManifestUpdater {
  const extension = Object.keys(BY_EXTENSION).find((suffix) => path.endsWith(suffix));
  const updater = extension ? BY_EXTENSION[extension] : undefined;
  if (!updater) throw new Error(`no manifest updater for ${path}`);
  return updater;
}
