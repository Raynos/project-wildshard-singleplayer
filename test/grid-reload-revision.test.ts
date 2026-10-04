// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridReloadRevision } from '../src/game/grid/reloadRevision';

it.each(['timeout', 'leave'])('aborts stalled reload metadata on %s without leaving a timer', async (reason) => {
  vi.useFakeTimers();
  const parent = new Scope('reload.metadata.test');
  const fetcher = vi.fn((_input: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => { reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  }));
  vi.stubGlobal('fetch', fetcher);
  try {
    const pending = gridReloadRevision(new GridAssembly({ developer: false, devserver: false }), 'driftwood-isle', parent);
    const refused = expect(pending).rejects.toThrow('Cancelled');
    if (reason === 'leave') parent.dispose();
    else await vi.advanceTimersByTimeAsync(10_000);
    await refused;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally { parent.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); }
});
