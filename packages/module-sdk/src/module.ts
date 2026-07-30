// The frontend module contract: a `@kroma/module-<id>` package exports one
// `KromaModule`, whose `id` must match its backend crate's module id.

import type { ComponentType } from 'react';
import type { KromaHost } from './host';
import type { Dependencies } from './types';

export interface NavItem {
  to: string;
  label: string;
  icon?: string;
  /** Host nav group ("library", "admin"). */
  section?: string;
  /** Capability the account needs; the host hides the entry otherwise. */
  requires?: string;
}

export interface ModuleComponentProps {
  host: KromaHost;
}

/** A route registered under the host's module mount point. */
export interface RouteDef {
  path: string;
  /** Wrap in `React.lazy` so each module is its own chunk. */
  component: ComponentType<ModuleComponentProps>;
}

export interface SettingsPanel {
  id: string;
  label: string;
  component: ComponentType<ModuleComponentProps>;
}

export interface KromaModule<Exports = unknown> {
  /** Stable id, shared with the backend crate's module manifest. */
  id: string;
  version: string;
  /** Version ranges are enforced on the backend; the frontend uses the id for
   *  setup ordering. */
  dependsOn?: Dependencies;
  /** Set up first when present, but not required. */
  optionalDependsOn?: Dependencies;
  routes?: RouteDef[];
  navItems?: NavItem[];
  settingsPanels?: SettingsPanel[];
  /** Keyed by locale code then message key. Resolved before the core catalogs,
   *  so a module ships translations without touching the app's typed key union. */
  locales?: Record<string, Record<string, string>>;
  /** Reached by other modules via `host.getModuleApi(id)`; computed once at
   *  start, in dependency order. */
  exports?: (host: KromaHost) => Exports;
  /** Runs once at start. */
  setup?: (host: KromaHost) => void | Promise<void>;
}
