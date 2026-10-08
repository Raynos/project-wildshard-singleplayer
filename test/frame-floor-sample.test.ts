// oxlint-disable-next-line import/no-nodejs-modules -- Exercises the exact source injected into both browser surfaces.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A controlled rAF schedule separates vsync cadence from callback jitter.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
const sampler = source.slice(source.indexOf('function sample(n)'), source.indexOf('// Runtime.evaluate'));
interface Sample { p95Ms: number; callbackP95Ms: number; workP95Ms: number; medianFps: number; frames: number; cpu: { enabled: boolean; frames: number; owners: { id: string; p95Ms: number }[] } }
function measure(period: number): Promise<Sample> {
  const cpu = { enabled: false, frame: 0, snapshot: () => ({ enabled: cpu.enabled, frame: cpu.frame, owners: [{ id: 'fixture', ms: 2, calls: 2 }] }) };
  const game = { app: { cpu }, frameCount: 0, frameI: 1, frameMs: [16.667], workMs: [3], lastFrame: { calls: 5, triangles: 10 }, renderer: { getContext: () => ({ isContextLost: () => false }) } };
  const queue: ((time: number) => void)[] = [];
  let now = 0;
  const promise = runInNewContext(`${sampler}\nsample(30)`, {
    window: { __wildshard: { world: { game, player: { position: { x: 0, y: 0, z: 0 } } } } },
    performance: { now: () => now }, requestAnimationFrame: (fn: (time: number) => void) => { queue.push(fn); return 1; },
    cancelAnimationFrame: () => undefined, setTimeout: () => 1, clearTimeout: () => undefined,
  }) as Promise<Sample>;
  for (let frame = 1; frame <= 31; frame++) {
    game.frameCount++; cpu.frame++;
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
  expect(result.cpu).toMatchObject({ enabled: true, frames: 30, owners: [{ id: 'fixture', p95Ms: 2 }] });
});
it('still detects missed vsyncs in the drawn-frame timestamps', async () => {
  const result = await measure(1000 / 30);
  expect(result.p95Ms).toBe(33.333);
  expect(result.p95Ms).toBeGreaterThan(17.5);
  expect(Math.round(result.medianFps)).toBe(30);
});

it('gates per-owner CPU even when the frame cadence passes, and refuses missing measurements', async () => {
  const end = source.indexOf('function grade(record)');
  const start = source.indexOf('function assess(result, surfaceName)');
  const assess = runInNewContext(`(${source.slice(start, end).trim()})`) as (sample: Sample, surface: string) => { pass: boolean; cpuPass: boolean };
  const result = await measure(1000 / 60);
  expect(assess(result, 'desktop')).toMatchObject({ pass: true, cpuPass: true });
  const expensive = { ...result, cpu: { ...result.cpu, owners: [{ id: 'fixture', p95Ms: 4.2 }] } };
  expect(assess(expensive, 'desktop')).toMatchObject({ pass: false, cpuPass: false });
  expect(assess(expensive, 'sim').cpuPass).toBe(true);
  expect(assess({ ...result, cpu: { enabled: false, frames: 0, owners: [] } }, 'desktop').pass).toBe(false);
});
