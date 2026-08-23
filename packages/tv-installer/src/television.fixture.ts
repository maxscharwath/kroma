import type { Television } from './television';

export function television(over: Partial<Television> = {}): Television {
  return {
    host: '192.168.1.10',
    platform: 'tizen',
    vendor: 'Samsung',
    name: 'Salon',
    model: 'QE55Q60A',
    developerMode: 'on',
    sideloadable: true,
    note: '',
    runtime: { name: 'Tizen', version: '8.0', engine: null, learned: 'reported' },
    ...over,
  };
}
