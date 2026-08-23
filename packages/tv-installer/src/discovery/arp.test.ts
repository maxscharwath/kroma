import { describe, expect, it } from 'vitest';
import { parseArpTable } from './arp';

const table = [
  '? (192.168.1.1) at dc:f5:1b:75:c6:c0 on en0 ifscope [ethernet]',
  '? (192.168.1.107) at 4:e4:b6:5d:38:a0 on en0 ifscope [ethernet]',
  '? (192.168.1.200) at (incomplete) on en0 ifscope [ethernet]',
  '? (192.168.1.107) at 4:e4:b6:5d:38:a0 on en1 ifscope [ethernet]',
  '? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]',
].join('\n');

describe('parseArpTable', () => {
  it('reads the address out of every resolved entry', () => {
    expect(parseArpTable(table)).toContain('192.168.1.1');
    expect(parseArpTable(table)).toContain('192.168.1.107');
  });

  it('leaves out an entry whose lookup never completed', () => {
    expect(parseArpTable(table)).not.toContain('192.168.1.200');
  });

  it('names a host once even when two interfaces know it', () => {
    expect(parseArpTable(table).filter((host) => host === '192.168.1.107')).toHaveLength(1);
  });

  it('answers nothing for an empty table', () => {
    expect(parseArpTable('')).toEqual([]);
  });
});
