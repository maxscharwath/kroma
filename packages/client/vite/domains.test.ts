import { describe, expect, it } from 'vitest';
import { domainIndex } from './domains.ts';

describe('the domain index', () => {
  it('imports a domain that has a client, for the augmentation a re-export would not load', () => {
    const text = domainIndex([{ name: 'media', hasClient: true }]);

    expect(text).toContain("import './media/client';");
    expect(text).toContain("export * from './media';");
  });

  it('re-exports a domain with no client without importing one', () => {
    const text = domainIndex([{ name: 'events', hasClient: false }]);

    expect(text).toContain("export * from './events';");
    expect(text).not.toContain("import './events/client';");
  });

  it('keeps the folders in one order, so the file does not churn', () => {
    const domains = [
      { name: 'media', hasClient: true },
      { name: 'accounts', hasClient: true },
    ];

    expect(domainIndex(domains)).toBe(domainIndex(domains));
  });
});
