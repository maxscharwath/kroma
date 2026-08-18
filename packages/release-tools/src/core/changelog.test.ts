import { describe, expect, it } from 'vitest';
import { prepend, renderEntry } from './changelog';
import { parseCommits } from './commits';

const commits = parseCommits([
  'feat(tv): android tv home channel',
  'fix(server): stop serving silence',
  'feat(server)!: reissue all tokens',
  'perf: cache the probe',
  'docs: tidy the readme',
]);

describe('renderEntry', () => {
  const entry = renderEntry('0.2.0', '2026-08-18', commits);

  it('headings the version and date', () => {
    expect(entry.startsWith('## 0.2.0 (2026-08-18)\n')).toBe(true);
  });

  it('orders sections as configured, breaking first', () => {
    const headings = entry.match(/^### .+$/gm);
    expect(headings).toEqual([
      '### ⚠ BREAKING CHANGES',
      '### Features',
      '### Bug Fixes',
      '### Performance Improvements',
    ]);
  });

  it('skips sections with no commits', () => {
    const onlyFeat = renderEntry('0.2.0', '2026-08-18', parseCommits(['feat: a thing']));
    expect(onlyFeat.match(/^### .+$/gm)).toEqual(['### Features']);
  });

  it('keeps the scope and drops release-neutral commits', () => {
    expect(entry).toContain('- **tv:** android tv home channel');
    expect(entry).not.toContain('tidy the readme');
  });

  it('renders a scopeless commit as a plain bullet', () => {
    expect(entry).toContain('- cache the probe');
  });

  it('lists a breaking commit once, only under the breaking section', () => {
    expect(entry.match(/reissue all tokens/g)).toHaveLength(1);
    const breaking = entry.indexOf('### ⚠ BREAKING CHANGES');
    expect(entry.indexOf('reissue all tokens')).toBeGreaterThan(breaking);
    expect(entry.indexOf('reissue all tokens')).toBeLessThan(entry.indexOf('### Features'));
  });

  it('separates every block by exactly one blank line and ends with one newline', () => {
    expect(entry).not.toMatch(/\n\n\n/);
    expect(entry).not.toMatch(/[ \t]+$/m);
    expect(entry.endsWith('\n')).toBe(true);
    expect(entry.endsWith('\n\n')).toBe(false);
  });

  it('places an optional summary under the heading, above the sections', () => {
    const withSummary = renderEntry('0.2.0', '2026-08-18', commits, {
      summary: '  A big TV release.  ',
    });
    expect(withSummary).toContain('\n\nA big TV release.\n\n### ');
  });

  it('renders a bare heading when no commit is release-worthy', () => {
    const empty = renderEntry('0.2.1', '2026-08-18', parseCommits(['docs: nothing to see']));
    expect(empty).toBe('## 0.2.1 (2026-08-18)\n');
  });

  it('honours a custom config', () => {
    const custom = renderEntry('1.0.0', '2026-08-18', commits, {
      config: {
        bumpOf: () => null,
        changelogHeader: '# Log',
        sections: [{ title: 'Docs', include: (c) => c.type === 'docs' }],
      },
    });
    expect(custom).toBe('## 1.0.0 (2026-08-18)\n\n### Docs\n\n- tidy the readme\n');
  });
});

describe('prepend', () => {
  const entry = '## 0.2.0 (2026-08-18)\n\n### Features\n\n- new\n';

  it('inserts a new entry under the header, above older ones', () => {
    const existing = '# Changelog\n\n## 0.1.0 (2026-01-01)\n\n### Features\n\n- old\n';
    expect(prepend(existing, entry)).toBe(
      '# Changelog\n\n## 0.2.0 (2026-08-18)\n\n### Features\n\n- new\n\n' +
        '## 0.1.0 (2026-01-01)\n\n### Features\n\n- old\n',
    );
  });

  it('seeds the header when the changelog is empty', () => {
    expect(prepend('', entry)).toBe(`# Changelog\n\n${entry}`);
    expect(prepend('   \n\n', entry)).toBe(`# Changelog\n\n${entry}`);
  });

  it('keeps a Keep-a-Changelog preamble above the new entry', () => {
    const existing =
      '# Changelog\n\nAll notable changes to this project are documented here.\n\n' +
      '## 0.1.0 (2026-01-01)\n\n- old\n';
    const out = prepend(existing, entry);
    expect(
      out.startsWith(
        '# Changelog\n\nAll notable changes to this project are documented here.\n\n## 0.2.0',
      ),
    ).toBe(true);
    expect(out.indexOf('0.2.0')).toBeLessThan(out.indexOf('0.1.0'));
  });

  it('adds the header to a file that starts straight at an entry', () => {
    const out = prepend('## 0.1.0 (2026-01-01)\n\n- old\n', entry);
    expect(out.startsWith('# Changelog\n\n## 0.2.0')).toBe(true);
  });

  it('accepts a custom header, including regex-special characters', () => {
    expect(prepend('', entry, '# Changes (v2+)')).toBe(`# Changes (v2+)\n\n${entry}`);
  });

  it('normalises spacing regardless of the entry or file whitespace', () => {
    const out = prepend('# Changelog\n\n\n\n## 0.1.0\n\n- old\n\n\n', `\n\n${entry}\n\n\n`);
    expect(out).toBe(
      '# Changelog\n\n## 0.2.0 (2026-08-18)\n\n### Features\n\n- new\n\n## 0.1.0\n\n- old\n',
    );
  });

  it('is idempotent in shape when applied twice', () => {
    const once = prepend('', entry);
    const twice = prepend(once, '## 0.3.0 (2026-09-01)\n\n### Bug Fixes\n\n- fixed\n');
    expect(twice.match(/^# Changelog$/gm)).toHaveLength(1);
    expect(twice).not.toMatch(/\n\n\n/);
    expect(twice.endsWith('\n')).toBe(true);
  });
});
