import { describe, expect, it } from 'vitest';
import { recordingClient } from '../../kroma-client.fixture';

const TORRENTS = {
  id: 'tv.kroma.torrents',
  name: 'Téléchargements',
  enabled: true,
  contributes: [
    {
      point: 'acquisition',
      label: 'qBittorrent',
      fields: [{ key: 'url', label: 'URL', type: 'string' }],
    },
  ],
};

describe('the module list', () => {
  it('reads a module with its contributions and add-form fields', async () => {
    const { client } = recordingClient(() => ({ json: [TORRENTS] }));

    const modules = await client.modules.list();

    expect(modules[0]?.id).toBe('tv.kroma.torrents');
    expect(modules[0]?.contributes?.[0]?.fields?.[0]?.key).toBe('url');
  });

  it('renders a field kind this build does not know as a text field', async () => {
    const odd = {
      ...TORRENTS,
      contributes: [{ point: 'acquisition', fields: [{ key: 'k', label: 'K', type: 'colour' }] }],
    };
    const { client } = recordingClient(() => ({ json: [odd] }));

    const modules = await client.modules.list();

    expect(modules[0]?.contributes?.[0]?.fields?.[0]?.type).toBe('string');
  });

  it('drops a module whose manifest the schema rejects and keeps the rest', async () => {
    const { client } = recordingClient(() => ({ json: [{ id: 42 }, TORRENTS] }));

    const modules = await client.modules.list();

    expect(modules).toHaveLength(1);
    expect(modules[0]?.id).toBe('tv.kroma.torrents');
  });

  it('rejects a body that is not a list at all', async () => {
    const { client } = recordingClient(() => ({ json: { modules: [] } }));

    await expect(client.modules.list()).rejects.toThrow();
  });
});
