// Registry management for the module Store: the pinned official catalog plus
// any the operator adds. Installing from a registry runs native code, so the
// list is admin-only and every artifact is still https + sha256 verified
// server-side — adding a registry lists modules, it does not trust them.

import { Button, Card, Pill, TextInput, Toggle, useAsyncAction } from '@kroma/admin-kit';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { adminApi } from '#web/features/admin/module-api';

/** One operator-added registry, as stored in the `moduleRegistries` setting. */
export interface ExtraRegistry {
  name: string;
  url: string;
  enabled: boolean;
}

/** One row of the registry list, as the catalog response reports it: the
 *  stored entry merged with its fetch outcome (absent when it was not
 *  consulted, e.g. disabled). */
export interface RegistryStatus {
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
  skipped?: string | null;
  error?: string | null;
  moduleCount: number;
  shadowed: string[];
}

const HTTPS = /^https:\/\/\S+$/;

function saveRegistries(extras: ExtraRegistry[]): Promise<unknown> {
  return adminApi('/settings', {
    method: 'PUT',
    body: JSON.stringify({ moduleRegistries: extras }),
  });
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function StatusLine({ status }: Readonly<{ status: RegistryStatus }>) {
  if (status.skipped) return <p className="text-xs text-dim">{status.skipped}</p>;
  if (status.error) {
    return <p className="break-all text-xs text-danger">{status.error}</p>;
  }
  const shadowed = status.shadowed.length;
  return (
    <p className="text-xs text-muted">
      {status.moduleCount} module{status.moduleCount === 1 ? '' : 's'}
      {shadowed > 0 && <> · {shadowed} hidden (already provided by a higher-priority registry)</>}
    </p>
  );
}

// The official slot stays first and wins an id clash, but WHERE it points is
// still editable: that is the long-standing escape hatch for pointing the Store
// at a mirror or a private build of the first-party catalog.
function OfficialRow({
  status,
  onSaved,
}: Readonly<{ status: RegistryStatus; onSaved: () => Promise<void> }>) {
  const url = status.url;
  const [value, setValue] = useState(url);
  const { busy, error, run } = useAsyncAction();
  const dirty = value.trim() !== url;
  const save = () =>
    void run(async () => {
      await adminApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({ moduleRegistryUrl: value.trim() }),
      });
      await onSaved();
    }, message);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-text">Official</span>
        <Pill>always first</Pill>
      </div>
      <p className="text-xs text-muted">
        The catalog attached to this project's GitHub Releases. It cannot be removed, and a module
        it publishes always wins over one with the same id from another registry. Leave the field
        empty for the built-in URL.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          value={value}
          onChange={setValue}
          placeholder="https://.../modules.json"
          className="min-w-72 flex-1"
        />
        <Button
          variant="secondary"
          label={busy ? 'Saving...' : 'Save'}
          onClick={save}
          loading={busy}
          disabled={!dirty}
        />
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <StatusLine status={status} />
    </Card>
  );
}

function ExtraRow({
  registry,
  status,
  busy,
  onChange,
  onRemove,
}: Readonly<{
  registry: ExtraRegistry;
  status: RegistryStatus;
  busy: boolean;
  onChange: (next: ExtraRegistry) => void;
  onRemove: () => void;
}>) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          value={registry.name}
          onChange={(name) => onChange({ ...registry, name })}
          placeholder="Name"
          className="w-48"
        />
        <Toggle on={registry.enabled} onChange={(enabled) => onChange({ ...registry, enabled })} />
        <span className="text-xs text-dim">{registry.enabled ? 'Enabled' : 'Disabled'}</span>
        <div className="flex-1" />
        <Button
          variant="quiet"
          label="Remove"
          icon={IconTrash}
          onClick={onRemove}
          disabled={busy}
        />
      </div>
      <TextInput
        value={registry.url}
        onChange={(url) => onChange({ ...registry, url })}
        placeholder="https://.../modules.json"
      />
      <StatusLine status={status} />
    </Card>
  );
}

function AddRegistry({
  onAdd,
  busy,
}: Readonly<{ onAdd: (r: ExtraRegistry) => void; busy: boolean }>) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const valid = HTTPS.test(url.trim());
  const add = () => {
    onAdd({ name: name.trim() || url.trim(), url: url.trim(), enabled: true });
    setName('');
    setUrl('');
  };
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="font-semibold text-text">Add a registry</span>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={name} onChange={setName} placeholder="Name" className="w-48" />
        <TextInput
          value={url}
          onChange={setUrl}
          placeholder="https://.../modules.json"
          className="min-w-72 flex-1"
        />
        <Button
          variant="primary"
          label="Add"
          icon={IconPlus}
          onClick={add}
          disabled={busy || !valid}
        />
      </div>
      {url.trim() !== '' && !valid && (
        <p className="text-xs text-danger">A registry URL must start with https://</p>
      )}
      <p className="text-xs text-muted">
        A third-party registry only adds entries to the list below. Every install is still verified
        against the checksum its catalog publishes, and refused without one.
      </p>
    </Card>
  );
}

/** The registry list: the pinned official catalog plus operator-added ones. */
export function RegistriesSection({
  registries,
  onReload,
}: Readonly<{ registries: RegistryStatus[]; onReload: () => Promise<void> }>) {
  const [draft, setDraft] = useState<ExtraRegistry[] | null>(null);
  const { busy: saving, error, run } = useAsyncAction();
  const official = registries.find((r) => r.official);
  const extras = registries.filter((r) => !r.official);
  const list: ExtraRegistry[] =
    draft ?? extras.map(({ name, url, enabled }) => ({ name, url, enabled }));
  const byUrl = new Map(extras.map((r) => [r.url, r]));

  // Saved as typed, including an entry whose URL is not (yet) valid: the server
  // keeps those and reports why it skipped them, so a typo stays on screen to be
  // corrected instead of vanishing on save. The draft is dropped only once the
  // refetch has landed, or the rows would snap back to the pre-save data.
  const commit = (next: ExtraRegistry[]) => {
    setDraft(next);
    void run(async () => {
      await saveRegistries(next);
      await onReload();
      setDraft(null);
    }, message);
  };

  if (registries.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-dim">Registries</h2>
        <p className="text-xs text-muted">Loading the registry list...</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-dim">Registries</h2>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      {official && <OfficialRow status={official} onSaved={onReload} />}
      {list.map((registry, i) => (
        <ExtraRow
          // Position, not URL: the URL is an edited field, and keying on it
          // remounts the row on every keystroke, which drops input focus.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
          key={i}
          registry={registry}
          status={
            byUrl.get(registry.url) ?? {
              ...registry,
              official: false,
              moduleCount: 0,
              shadowed: [],
            }
          }
          busy={saving}
          onChange={(next) => setDraft(list.map((r, j) => (i === j ? next : r)))}
          onRemove={() => commit(list.filter((_, j) => j !== i))}
        />
      ))}
      {draft !== null && (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            label={saving ? 'Saving...' : 'Save changes'}
            onClick={() => commit(list)}
            loading={saving}
          />
          <Button
            variant="quiet"
            label="Discard"
            onClick={() => setDraft(null)}
            disabled={saving}
          />
        </div>
      )}
      <AddRegistry busy={saving} onAdd={(r) => commit([...list, r])} />
    </section>
  );
}
