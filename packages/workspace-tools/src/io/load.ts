import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Graph, Project } from '../core/graph';

// Read a repo into a Graph. This is the only filesystem-touching code; the graph
// algorithms operate on its output, not on disk. Conventions are Kroma's but
// obvious: a Rust server, JS workspaces, and `.kmod` modules under modules/.

interface LoadOptions {
  root: string;
  // Directories to scan for JS `package.json` projects.
  workspaceRoots?: string[];
  serverManifest?: string;
  modulesDir?: string;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function subdirs(root: string, rel: string): string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `${rel}/${e.name}`);
}

// `engines: { "<name>": "<range>" }`, as a module declares what its host must be.
function engineRange(engines: unknown, name: string): string | undefined {
  if (!engines || typeof engines !== 'object' || Array.isArray(engines)) return undefined;
  const value = (engines as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function cargoVersion(text: string): string {
  return text.match(/^version[ \t]*=[ \t]*"([^"]+)"/m)?.[1] ?? '0.0.0';
}

export function loadGraph(options: LoadOptions): Graph {
  const {
    root,
    workspaceRoots = ['packages', 'clients', 'apps'],
    serverManifest = 'server/Cargo.toml',
    modulesDir = 'modules',
  } = options;

  const projects: Project[] = [];
  let server: Project | undefined;

  // The Rust server.
  const serverPath = join(root, serverManifest);
  if (existsSync(serverPath)) {
    server = {
      name: 'server',
      dir: serverManifest.replace(/\/Cargo\.toml$/, ''),
      manifest: serverManifest,
      version: cargoVersion(readFileSync(serverPath, 'utf8')),
      deps: [],
    };
    projects.push(server);
  }

  // JS workspace projects. First pass records names so the second can resolve
  // internal dependency edges (a dep is "internal" when it names another project).
  const npm: Array<{ project: Project; rawDeps: string[] }> = [];
  for (const wsRoot of workspaceRoots) {
    for (const dir of subdirs(root, wsRoot)) {
      const pkg = readJson(join(root, dir, 'package.json'));
      if (!pkg || typeof pkg.name !== 'string') continue;
      const deps = {
        ...(pkg.dependencies as Record<string, string> | undefined),
        ...(pkg.devDependencies as Record<string, string> | undefined),
      };
      npm.push({
        project: {
          name: pkg.name,
          dir,
          manifest: `${dir}/package.json`,
          version: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
          deps: [],
        },
        rawDeps: Object.keys(deps),
      });
    }
  }
  const npmNames = new Set(npm.map((n) => n.project.name));
  for (const { project, rawDeps } of npm) {
    project.deps = rawDeps.filter((d) => npmNames.has(d));
    projects.push(project);
  }

  // `.kmod` modules: version, dependency ranges, and the server floor.
  for (const dir of subdirs(root, modulesDir)) {
    const manifest = readJson(join(root, dir, 'module.json'));
    if (!manifest || typeof manifest.id !== 'string') continue;
    const dependencies = manifest.dependencies;
    const ranges =
      dependencies && !Array.isArray(dependencies)
        ? (dependencies as Record<string, string>)
        : undefined;
    projects.push({
      name: manifest.id,
      dir,
      manifest: `${dir}/module.json`,
      version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
      deps: ranges ? Object.keys(ranges) : [],
      ranges,
      serverRange: engineRange(manifest.engines, 'server'),
    });
  }

  return { projects, server };
}
