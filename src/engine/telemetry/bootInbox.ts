/** Renderer-free transport. nineBootTrace owns the durable queue until the server acknowledges it. */
import type { SendResult } from '../core/errorReport';

const ERRORS_URL = import.meta.env.MODE === 'native' ? 'https://wildshard-singleplayer.vercel.app/api/errors' : '/api/errors';

export async function reportBootInterruption(error: Error, build: string, diagnostic: string, system = 'boot-abrupt'): Promise<SendResult> {
  try {
    const response = await fetch(ERRORS_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ system, message: error.message.slice(0, 500), stack: '', count: 1,
        fatal: false, disabled: false, sinceBootMs: 0,
        context: { build, shard: 'nine-dragon-stack', bootDiagnostic: diagnostic } }),
    });
    if (response.ok) return 'ok';
    return response.status === 429 || response.status >= 500 ? 'retry' : 'reject';
  } catch { return 'retry'; }
}
