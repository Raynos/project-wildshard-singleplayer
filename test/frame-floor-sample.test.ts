// oxlint-disable-next-line import/no-nodejs-modules -- Exercises the exact source injected into both browser surfaces.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A controlled rAF schedule separates vsync cadence from callback jitter.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
const sampler = source.slice(source.indexOf('function sample(n,'), source.indexOf('// Runtime.evaluate'));
interface Sample { sampleRange: { startMs: number; endMs: number }; p95Ms: number; callbackP95Ms: number; workP95Ms: number; medianFps: number; frames: number; cpu: { enabled: boolean; frames: number; owners: { id: string; p95Ms: number }[] } }
function measure(period: number, timeline = false, count = 30): Promise<Sample & { frameTimeline?: { limit: number; droppedFrames: number; frames: { intervalMs: number; callbackDelayMs: number; gameRafMs: number; updateMs: number; renderMs: number; workMs: number; frameDelta: number }[] } }> {
  const cpu = { enabled: false, frame: 0, snapshot: () => ({ enabled: cpu.enabled, frame: cpu.frame, owners: [{ id: 'fixture', ms: 2, calls: 2 }] }) };
  const game = { app: { cpu }, frameCount: 0, frameRafTime: 0, frameI: 1, frameMs: [16.667], workMs: [3], updateMs: [1], renderMs: [2], lastFrame: { calls: 5, triangles: 10 }, renderer: { getContext: () => ({ isContextLost: () => false }) } };
  const queue: ((time: number) => void)[] = [];
  let now = 0;
  const promise = runInNewContext(`${sampler}\nsample(${count},${timeline})`, {
    frameTimeline: timeline,
    window: { __wildshard: { world: { game, player: { position: { x: 0, y: 0, z: 0 } } } } },
    performance: { now: () => now }, requestAnimationFrame: (fn: (time: number) => void) => { queue.push(fn); return 1; },
    cancelAnimationFrame: () => undefined, setTimeout: () => 1, clearTimeout: () => undefined,
  }) as Promise<Sample>;
  for (let frame = 1; frame <= count + 1; frame++) {
    game.frameCount++; cpu.frame++;
    game.frameRafTime = frame * period;
    now = frame * period + (frame % 2 ? 0 : 8);
    const tick = queue.shift();
    if (!tick) throw new Error('Sampler stopped scheduling rAF');
    tick(frame * period);
  }
  return promise;
}
it('keeps the bounded timeline opt-in and separates cadence from callback delay and game work', async () => {
  const plain = await measure(1000 / 30);
  const diagnostic = await measure(1000 / 30, true);
  expect(plain.frameTimeline).toBeUndefined();
  expect(diagnostic.p95Ms).toBe(plain.p95Ms);
  expect(diagnostic.cpu).toEqual(plain.cpu);
  expect(diagnostic.frameTimeline?.frames).toHaveLength(30);
  expect(diagnostic.frameTimeline?.frames[0]).toMatchObject({ intervalMs: 1000 / 30,
    callbackDelayMs: 8, gameRafMs: 2000 / 30, updateMs: 1, renderMs: 2, workMs: 3, frameDelta: 1 });
  const capped = await measure(1000 / 60, true, 8010);
  expect(capped.frames).toBe(8010);
  expect(capped.frameTimeline?.frames).toHaveLength(8000);
  expect(capped.frameTimeline?.droppedFrames).toBe(10);
});
it.each([true, false])('retains every whole-drive GL counter with concurrent samplers (short first: %s)', async shortFirst => {
  const cpu = { enabled: false, frame: 0, snapshot: () => ({ enabled: cpu.enabled, frame: cpu.frame, owners: [{ id: 'fixture', ms: 2, calls: 1 }] }) };
  const game = { app: { cpu }, frameCount: 0, frameI: 1, frameMs: [60], workMs: [3],
    lastFrame: { calls: 5, triangles: 10 }, renderer: { getContext: () => ({ isContextLost: () => false }) } };
  const queue: ((time: number) => void)[] = [];
  let now = 0, pending = false, takes = 0;
  interface GlSample { frames: number; glFrames?: [number, { drawElements: [number, number] }][] }
  const promise = runInNewContext(`${sampler}\nPromise.all([sample(${shortFirst ? 30 : 0}),sample(${shortFirst ? 0 : 30})])`, {
    frameTimeline: false,
    window: { __frameFloorDriveDone: true, __frameFloorGlTake: () => {
      takes++;
      if (!pending) return null;
      pending = false; return { drawElements: [2, 1] };
    }, __wildshard: { world: { game, player: { position: { x: 0, y: 0, z: 0 } } },
      shard: { grid: { state: () => ({ live: { runtimeTiming: { current: null } } }) } } } },
    performance: { now: () => now }, requestAnimationFrame: (fn: (time: number) => void) => { queue.push(fn); return 1; },
    cancelAnimationFrame: () => undefined, setTimeout: () => 1, clearTimeout: () => undefined,
  }) as Promise<GlSample[]>;
  for (let frame = 1; frame <= 31; frame++) {
    game.frameCount++; cpu.frame++; now = frame * 60; pending = true;
    for (const tick of queue.splice(0)) tick(now);
  }
  const results = await promise;
  const whole = results[shortFirst ? 1 : 0], short = results[shortFirst ? 0 : 1];
  expect(short?.glFrames).toBeUndefined();
  expect(whole?.frames).toBe(30);
  expect(whole?.glFrames).toHaveLength(30);
  expect(whole?.glFrames?.map(([, gl]) => gl.drawElements)).toEqual(Array.from({ length: 30 }, () => [2, 1]));
  expect(takes).toBe(31); // First whole counter is discarded; each subsequent counter belongs to one interval.
});
it('grades vsync cadence while retaining preceding-work callback jitter as a diagnostic', async () => {
  const result = await measure(1000 / 60);
  expect(Math.round(result.medianFps)).toBe(60);
  expect(result.p95Ms).toBe(16.667);
  expect(result.sampleRange).toEqual({ startMs: 16.667, endMs: 516.667 });
  expect(result.callbackP95Ms).toBe(24.667);
  expect(result.workP95Ms).toBe(3);
  expect(result.cpu).toMatchObject({ enabled: true, frames: 30, owners: [{ id: 'fixture', p95Ms: 2 }] });
});
it('still detects missed vsyncs in the drawn-frame timestamps', async () => {
  const result = await measure(1000 / 30);
  expect(result.p95Ms).toBe(33.333);
  expect(result.sampleRange).toEqual({ startMs: 33.333, endMs: 1033.333 });
  expect(result.p95Ms).toBeGreaterThan(17.5);
  expect(Math.round(result.medianFps)).toBe(30);
});

it('accepts Simulator cap jitter through 35 ms without forgiving missed vsyncs', async () => {
  const end = source.indexOf('function grade(record)');
  const start = source.indexOf('function assess(result, surfaceName)');
  const assess = runInNewContext(`(${source.slice(start, end).trim()})`) as (sample: object, surface: string) => { pass: boolean; limitMs: number };
  const result = await measure(1000 / 30);
  expect(assess({ ...result, p95Ms: 35 }, 'sim')).toMatchObject({ pass: true, limitMs: 35 });
  expect(assess({ ...result, p95Ms: 35.001 }, 'sim').pass).toBe(false);
  expect(assess(result, 'desktop').pass).toBe(false);
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

it('fails every phase on one long frame that median and p95 never see (100 ms desktop / 200 ms Simulator)', async () => {
  const end = source.indexOf('function grade(record)');
  const start = source.indexOf('function assess(result, surfaceName)');
  interface Graded { pass: boolean; maxFramePass: boolean; maxFrameLimitMs: number; miss: string | null }
  const assess = runInNewContext(`(${source.slice(start, end).trim()})`) as (sample: object, surface: string) => Graded;
  const result = await measure(1000 / 60);
  const drive = (maxMs: number) => ({ ...result, maxMs, pose: { name: 'grid-template-interior-drive' } });
  expect(assess(drive(99), 'desktop')).toMatchObject({ pass: true, maxFramePass: true, maxFrameLimitMs: 100 });
  expect(assess(drive(13316), 'desktop')).toMatchObject({ pass: false, maxFramePass: false, miss: 'long frame: max 13316 ms > 100 ms' });
  expect(assess(drive(150), 'sim')).toMatchObject({ maxFramePass: true, maxFrameLimitMs: 200 });
  expect(assess(drive(232), 'sim').maxFramePass).toBe(false);
  for (const name of ['spawn', 'grid-template-interior-travel', 'grid-template-interior']) {
    expect(assess({ ...result, maxMs: 100, pose: { name } }, 'desktop')).toMatchObject({ pass: true, maxFrameLimitMs: 100 });
    expect(assess({ ...result, maxMs: 100.001, pose: { name } }, 'desktop')).toMatchObject({ pass: false, maxFramePass: false });
    expect(assess({ ...result, maxMs: 200, pose: { name } }, 'sim')).toMatchObject({ maxFramePass: true, maxFrameLimitMs: 200 });
    expect(assess({ ...result, maxMs: 200.001, pose: { name } }, 'sim')).toMatchObject({ pass: false, maxFramePass: false });
    expect(assess({ ...result, maxMs: Number.NaN, pose: { name } }, 'desktop').pass).toBe(false);
    expect(assess({ ...result, maxMs: Infinity, pose: { name } }, 'sim').pass).toBe(false);
  }
});

it('refuses a standing row displaced onto the road after its home retired', () => {
  const start = source.indexOf('function assertStandingPosition('), end = source.indexOf('/** Profile the exact standing window');
  const verify = runInNewContext(`(${source.slice(start, end).trim()})`) as (pose: { name: string; x: number; z: number }, sample: { position: { x: number; z: number } }) => void;
  const pose = { name: 'spawn', x: 0, z: -194 };
  expect(() => verify(pose, { position: { x: 273.9, z: -40 } })).toThrow('Standing pose spawn moved');
  expect(() => verify(pose, { position: { x: 0.00001, z: -194.00001 } })).not.toThrow();
});

it('samples the actual boot spawn before any camera scan can retire its world', async () => {
  const start = source.indexOf('async function measureShard('), end = source.indexOf('/** Long tasks inside a profiled travel leg');
  const order: string[] = [], spawn = { name: 'spawn', x: 0, z: -194 };
  const meta = { developer: true, deviceSaves: { devMode: true }, clock: 'live', renderScale: 2, settings: { tier: 'desktop', fps: 'auto' }, renderer: 'ANGLE Metal Renderer', spawn };
  const run = runInNewContext(`(${source.slice(start, end).trim()})`, {
    surface: 'desktop', developer: 'on', picks: {}, deviceSaves: {}, expectedSystems: [], publicGrid: false, gridScenario: 'baseline',
    waitReady: () => Promise.resolve(), sleep: () => Promise.resolve(), settleMs: 2000, evaluationOriginDriftMaxMs: 0,
    gridFloorDocumentIdentity: () => ({}), metadata: () => ({}), cameras: () => ({}),
    standingSample: (_driver: object, pose: object) => { order.push('spawn'); expect(pose).toEqual(spawn); return Promise.resolve({ pass: true }); },
    errorText: (error: Error) => error.message, gridFloorRuntimeFailure: () => null, console: { log: () => undefined, error: () => undefined },
  }) as (driver: object, shard: string, deadline: number) => Promise<object>;
  let reads = 0;
  await run({
    load: () => Promise.resolve(),
    evaluate: () => {
      reads++;
      if (reads === 2) return Promise.resolve(meta);
      if (reads === 3) { order.push('scan'); return Promise.reject(new Error('Stop after observing camera scan')); }
      return Promise.resolve({});
    },
    errors: () => Promise.resolve([]), progress: () => null, unload: () => { order.push('unload'); return Promise.resolve(); },
  }, '_template', Date.now() + 10000);
  expect(order).toEqual(['spawn', 'scan', 'unload']);
});
