// oxlint-disable-next-line import/no-nodejs-modules -- Exercises the exact source injected into both browser surfaces.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A controlled rAF schedule separates vsync cadence from callback jitter.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
const sampler = source.slice(source.indexOf('function sample(n)'), source.indexOf('// Runtime.evaluate'));
interface Sample { p95Ms: number; callbackP95Ms: number; workP95Ms: number; medianFps: number }
function measure(period: number): Promise<Sample> {
  const game = { frameCount: 0, frameI: 1, frameMs: [16.667], workMs: [3], lastFrame: { calls: 5, triangles: 10 }, renderer: { getContext: () => ({ isContextLost: () => false }) } };
  const queue: ((time: number) => void)[] = [];
  let now = 0;
  const promise = runInNewContext(`${sampler}\nsample(30)`, {
    window: { __wildshard: { world: { game, player: { position: { x: 0, y: 0, z: 0 } } } } },
    performance: { now: () => now }, requestAnimationFrame: (fn: (time: number) => void) => { queue.push(fn); return 1; },
    cancelAnimationFrame: () => undefined, setTimeout: () => 1, clearTimeout: () => undefined,
  }) as Promise<Sample>;
  for (let frame = 1; frame <= 31; frame++) {
    game.frameCount++;
    now = frame * period + (frame % 2 ? 0 : 8);
    const tick = queue.shift();
    if (!tick) throw new Error('Sampler stopped scheduling rAF');
    tick(frame * period);
  }
  return promise;
}
it('grades vsync cadence while retaining preceding-work callback jitter as a diagnostic', async () => {
  const result = await measure(1000 / 60);
  expect(Math.round(result.medianFps)).toBe(60);
  expect(result.p95Ms).toBe(16.667);
  expect(result.callbackP95Ms).toBe(24.667);
  expect(result.workP95Ms).toBe(3);
});
it('still detects missed vsyncs in the drawn-frame timestamps', async () => {
  const result = await measure(1000 / 30);
  expect(result.p95Ms).toBe(33.333);
  expect(result.p95Ms).toBeGreaterThan(17.5);
  expect(Math.round(result.medianFps)).toBe(30);
});
