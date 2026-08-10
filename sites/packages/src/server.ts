import handler from '@tanstack/react-start/server-entry';
import { type ExecCtx, machineResponse } from '#pkg/lib/api';
import type { Env } from '#pkg/lib/catalog';

export default {
  async fetch(request: Request, env: Env, ctx: ExecCtx): Promise<Response> {
    const machine = await machineResponse(request, env, ctx);
    return machine ?? handler.fetch(request);
  },
};
