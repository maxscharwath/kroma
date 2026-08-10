import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageKeysIn, subsetCatalog } from './message-subset';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'kroma-messages-'));
  for (const [path, source] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    writeFileSync(full, source);
  }
  return root;
}

describe('the scan', () => {
  it('finds a key behind t() and behind msg(), in any quote', () => {
    const root = tree({
      'a/one.tsx': "const label = t('common.close');",
      'a/two.ts': 'const e = msg(`form.required`);',
      'a/three.ts': 'const x = t("player.play");',
    });
    expect(messageKeysIn([root])).toEqual(
      new Set(['common.close', 'form.required', 'player.play']),
    );
  });

  it('walks nested directories and skips node_modules and dotfiles', () => {
    const root = tree({
      'deep/nested/here.tsx': "t('a.kept')",
      'node_modules/dep/index.ts': "t('a.dropped')",
      '.cache/gen.ts': "t('b.dropped')",
      'notes.md': "t('c.dropped')",
    });
    expect(messageKeysIn([root])).toEqual(new Set(['a.kept']));
  });

  it('reads no key out of a call whose argument is not a literal', () => {
    const root = tree({ 'a.ts': 'const label = t(entry.labelKey);' });
    expect(messageKeysIn([root]).size).toBe(0);
  });

  it('answers empty for a root that is not there', () => {
    expect(messageKeysIn(['/no/such/tree']).size).toBe(0);
  });
});

describe('the subset', () => {
  const CATALOG = {
    'common.close': 'Fermer',
    'admin.backupWarning': 'Attention',
    'lang.fr': 'Français',
    'lang.en': 'English',
    'player.episodes_one': '{count} épisode',
    'player.episodes_other': '{count} épisodes',
    'admin.jobs_other': '{count} tâches',
  };

  it('keeps a named message and drops every other', () => {
    expect(subsetCatalog(CATALOG, new Set(['common.close']))).toEqual({
      'common.close': 'Fermer',
      'lang.fr': 'Français',
      'lang.en': 'English',
    });
  });

  it('keeps the plural variants of a named message', () => {
    const kept = subsetCatalog(CATALOG, new Set(['player.episodes']));
    expect(kept['player.episodes_one']).toBe('{count} épisode');
    expect(kept['player.episodes_other']).toBe('{count} épisodes');
    expect(kept['admin.jobs_other']).toBeUndefined();
  });

  it('always keeps the language names, which locale detection matches on', () => {
    expect(Object.keys(subsetCatalog(CATALOG, new Set()))).toEqual(['lang.fr', 'lang.en']);
  });
});
