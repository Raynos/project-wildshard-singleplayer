import { expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the exact Safari instrumentation source under plain Node.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolates the pre-boot instrumentation without starting a GPU browser.
import { runInNewContext } from 'node:vm';

it('reports the exact raw allocator sum and refuses unsettled or missing regional telemetry', () => {
  const grid = { accountedBytes: 200_000_123, residentMB: 200, rings: { inFlight: 0, queued: 0 },
    live: { live: { pending: [] as string[], gameplayReady: true } } };
  const target: { __sf57ReadGL?: () => { accountedBytes: number | null; settled: boolean }; __sc_gl: () => never[];
    __wildshard: { shard: { grid: { state: () => typeof grid | undefined } } }; addEventListener: () => void } = {
    __sc_gl: () => [], __wildshard: { shard: { grid: { state: () => grid } } }, addEventListener: () => undefined,
  };
  const source = readFileSync('scripts/soak/gl.mjs', 'utf8').replace('export function', 'function');
  runInNewContext(`${source};installSoakGl()`, { window: target, setInterval: () => 1 });
  const read = target.__sf57ReadGL;
  if (read === undefined) throw new Error('GL reader was not installed');
  expect(read().accountedBytes).toBe(200_000_123); expect(read().settled).toBe(true);
  grid.rings.inFlight = 1; expect(read().settled).toBe(false); grid.rings.inFlight = 0;
  grid.rings.queued = 1; expect(read().settled).toBe(false); grid.rings.queued = 0;
  grid.live.live.pending.push('template-1'); expect(read().settled).toBe(false); grid.live.live.pending.length = 0;
  grid.live.live.gameplayReady = false; expect(read().settled).toBe(false);
  target.__wildshard.shard.grid.state = () => undefined;
  expect(read().settled).toBe(false); expect(read().accountedBytes).toBeNull();
});
