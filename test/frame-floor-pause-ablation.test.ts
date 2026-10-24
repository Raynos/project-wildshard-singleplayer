import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- execute actual serialized diagnostic without Safari
import {runInNewContext} from 'node:vm';
import {ABLATION_NORMAL, ABLATION_PAUSED, ABLATION_BUFFERS} from '../scripts/frame-floor-pause-ablation.mjs';
import {validateFrameFloorArgs} from '../scripts/frame-floor-args.mjs';

function fixture(paused = false) {
  let now = 100, next = 0, begins = 0, ends = 0;
  const rafs = new Map<number, (at: number) => void>(), timers = new Map<number, () => void>();
  const clock = {frame: 50, now: 200}, game = {frameCount: 50, frameRafTime: 90, frameGate: () => !paused, app: {clock}};
  const world = {game, hud: {entered: true, paused}};
  const context = {window: {__wildshard: {world}, __frameFloorBufferPressure: {
    begin() {begins++;}, take() {ends++; return {rows: []};},
  }}, performance: {now: () => now}, document: {querySelector: () => paused ? {} : null},
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- emulate native scheduler deterministically
    requestAnimationFrame(callback: (at: number) => void) {rafs.set(++next, callback); return next;},
    cancelAnimationFrame(id: number) {rafs.delete(id);},
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- native deadline fixture
    setTimeout(callback: () => void) {timers.set(++next, callback); return next;}, clearTimeout(id: number) {timers.delete(id);}};
  return {world, context, rafs, timers, get begins() {return begins;}, get ends() {return ends;},
    frame(at: number) {now = at; if (!paused) {game.frameCount++; game.frameRafTime = at; clock.frame++; clock.now++;}
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- drive native scheduler fixture synchronously
      const current = [...rafs.values()]; rafs.clear(); for (const callback of current) callback(at);},
    start(code: string): Promise<unknown> {return Promise.resolve(runInNewContext(code, context));}};
}

test('A uses actual drawn intervals without activating any buffer wrappers', async () => {
  const f = fixture(), result = f.start(ABLATION_NORMAL);
  f.frame(100); f.frame(133); f.frame(20100);
  await expect(result).resolves.toMatchObject({mode: 'normal', frames: 3, missedDraws: 0, intervals: [[100,33],[133,19967]], dropped: 0});
  expect(f.begins).toBe(0); expect(f.ends).toBe(0); expect(f.rafs.size + f.timers.size).toBe(0);
});

test('B completes with browser rAF but zero simulation ticks or drawn frames', async () => {
  const f = fixture(true), result = f.start(ABLATION_PAUSED);
  f.frame(100); f.frame(20100);
  await expect(result).resolves.toMatchObject({mode: 'paused', frames: 0, intervals: [], browserIntervals: [[100,20000]],
    before: {tick: 50, frames: 50, paused: true, frameGate: false, menuVisible: true}, after: {tick: 50, frames: 50}});
  expect(f.begins).toBe(0); expect(f.rafs.size + f.timers.size).toBe(0);
});

test.each(['replacement', 'deadline'] as const)('C retires wrappers on %s refusal', async reason => {
  const f = fixture(), result = f.start(ABLATION_BUFFERS);
  if (reason === 'replacement') { f.context.window.__wildshard = {world: {...f.world}}; f.frame(20100); }
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- fire stored deadline without waiting thirty seconds
  else for (const callback of f.timers.values()) callback();
  await expect(result).rejects.toThrow(reason === 'replacement' ? 'world/controls/menu' : 'deadline');
  expect(f.begins).toBe(1); expect(f.ends).toBe(1); expect(f.rafs.size + f.timers.size).toBe(0);
});

test('C activates and freezes the probe only within its entered window', async () => {
  const f = fixture(), result = f.start(ABLATION_BUFFERS);
  f.frame(20100);
  await expect(result).resolves.toMatchObject({mode: 'buffers', allocation: {rows: []}});
  expect(f.begins).toBe(1); expect(f.ends).toBe(1);
});

test('ablation requires exactly the Nalati settled Timeline and excludes native pressure', () => {
  const args = ['--surface=sim','--shards=grid','--grid-scenario=all','--webkit-timeline=tmp/timeline','--webkit-steady=grid-nalati-interior','--pause-ablation','--quiet'];
  expect(() => validateFrameFloorArgs(args)).not.toThrow();
  expect(() => validateFrameFloorArgs(args.filter(a => !a.startsWith('--webkit-steady')))).toThrow('Pause ablation');
  expect(() => validateFrameFloorArgs([...args,'--native-pressure=tmp/probe'])).toThrow('Pause ablation');
});
