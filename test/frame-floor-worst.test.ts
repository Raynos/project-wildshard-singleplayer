import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- exercise the real serialized sampler without starting a browser or Simulator
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- isolate the real page sampler with controlled drawn-frame timestamps
import {runInNewContext} from 'node:vm';

async function sampleIntervals(intervals: number[]): Promise<unknown> {
  const source = readFileSync(new URL('../scripts/frame-floor.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function sample(n, timeline = false) {');
  const end = source.indexOf('/** the whole-drive sampler', start);
  if (start === -1 || end <= start) throw new Error('Serialized sampler not found');
  const callbacks: ((at: number) => void)[] = [];
  let now = 100;
  const game = {frameCount: 0, frameI: 1, frameMs: [33], workMs: [1], lastFrame: {calls: 1, triangles: 1},
    app: {cpu: {enabled: false, snapshot: () => ({enabled: true, frame: 0, owners: []})}},
    renderer: {getContext: () => ({isContextLost: () => false})}};
  const context = {window: {__wildshard: {world: {game, player: {position: {x: 0, y: 0, z: 0}}}}},
    performance: {now: () => now}, setTimeout: () => 1, clearTimeout: () => undefined,
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- the real sampler schedules native rAF callbacks, which the fixture must retain until a drawn frame
    cancelAnimationFrame: () => undefined, requestAnimationFrame: (callback: (at: number) => void) => {
      callbacks.push(callback); return callbacks.length;
    }};
  const result: unknown = runInNewContext(`(${source.slice(start, end)})(${intervals.length})`, context);
  for (const delta of [0, ...intervals]) {
    now += delta; game.frameCount++;
    const callback = callbacks.shift();
    if (callback === undefined) throw new Error('Sampler stopped before every drawn frame');
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- deliver the retained native rAF callback at the controlled frame timestamp
    callback(now);
  }
  expect(callbacks).toHaveLength(0);
  return await result;
}

test('retains the six worst real cadence intervals without changing the measured sample', async () => {
  expect(await sampleIntervals([33.111, 80.222, 35.123, 70.123, 40.456, 60.789, 50.222, 45.123, 34.555]))
    .toMatchObject({frames: 9, skipped: 0, p50Ms: 45.123, p95Ms: 80.222, p99Ms: 80.222, maxMs: 80.222,
      worstFrameMs: [80.222, 70.123, 60.789, 50.222, 45.123, 40.456]});
});

test('keeps ties and reports only existing intervals in samples shorter than six', async () => {
  expect(await sampleIntervals([34, 34, 34])).toMatchObject({frames: 3, worstFrameMs: [34, 34, 34]});
});
