import { describe } from 'vitest';
import { checkEndpoints } from '../../endpoints.fixture';

const CRASH = {
  message: 'boom',
  stack: 'at <anonymous>',
  platform: 'web',
  capturedAt: 1,
  build: { version: '1.0.0', commit: null },
  device: null,
};

describe('the diagnostics endpoints', () => {
  checkEndpoints([
    {
      name: 'crash',
      call: (c) => c.diagnostics.crash(CRASH),
      method: 'POST',
      path: '/diagnostics/crash',
      body: CRASH,
    },
  ]);
});
