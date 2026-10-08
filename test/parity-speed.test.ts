import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only harness fixtures use isolated temporary repositories and a browser-API VM.
import { runInNewContext } from 'node:vm';
import { parallel } from '../scripts/parity/pool.mjs';
import { cachedTree, runtimeTree } from '../scripts/parity/serve.mjs';
import { fastSelection, nextRotation } from '../scripts/parity/profile.mjs';
import { telemetryOnlyWrite } from '../scripts/parity/saves.mjs';
import { installFrameDriver } from '../scripts/parity/clock.mjs';
import { telemetryFixtureAccepts } from '../scripts/parity/telemetry.mjs';

describe('P1 bounded capture scheduling', () => {
  it('runs record repetitions concurrently and preserves input order', async () => {
    const started: number[] = [], releases: (() => void)[] = [];
    const result = parallel([0, 1, 2, 3], 3, async (item) => {
      started.push(item); await new Promise<void>((resolve) => { releases[item] = resolve; }); return item;
    });
    expect(started).toEqual([0, 1, 2]);
    releases[2]?.(); await Promise.resolve(); await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);
    releases[3]?.(); releases[1]?.(); releases[0]?.();
    expect(await result).toEqual([0, 1, 2, 3]);
  });
  it('drains in-flight work after failure without starting queued captures', async () => {
    let drained = false;
    const started: number[] = [];
    await expect(parallel([0, 1, 2], 2, async (item) => {
      started.push(item);
      if (item === 0) throw new Error('boot failed');
      await Promise.resolve(); drained = true; return item;
    })).rejects.toThrow('boot failed');
    expect(drained).toBe(true); expect(started).toEqual([0, 1]);
  });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'parity-speed-test-'));
  const put = (path: string, content: string) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content); };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.email', 'p1@example.invalid'); git('config', 'user.name', 'P1 test');
  put('.vercelignore', '/docs\n/test/parity\n'); put('docs/note.md', 'ignored');
  put('src/engine/shared.ts', 'export const shared=1;'); put('src/engine/only-a.ts', 'export const a=1;');
  for (const shard of ['a', 'b', 'c', 'd']) put(`src/shards/${shard}/manifest.ts`, `import '@wildshard/engine/shared';${shard === 'a' ? "import '@wildshard/engine/only-a';" : ''}`);
  put('test/parity/baselines/m5/a.phone.json', '{"sha":"first"}'); put('scripts/parity.mjs', 'harness');
  git('add', '.'); git('commit', '-qm', 'fixture');
  return { root, put, git, close: () => rmSync(root, { recursive: true, force: true }) };
}

describe('P1 runtime build cache', () => {
  it('reuses identical runtime inputs while reading baselines from the requested SHA', async () => {
    const f = fixture(); let builds = 0;
    const build = (tree: string) => { builds++; mkdirSync(join(tree, 'dist')); writeFileSync(join(tree, 'dist/version.json'), '{}'); };
    try {
      const first = f.git('rev-parse', 'HEAD'), key = runtimeTree(f.root, first);
      const a = await cachedTree(f.root, first, join(f.root, 'cache'), build); expect(a.hit).toBe(false); a.cleanup();
      f.put('docs/note.md', 'new note'); f.put('scripts/parity.mjs', 'new harness'); f.put('test/parity/baselines/m5/a.phone.json', '{"sha":"second"}');
      f.git('add', 'docs/note.md', 'scripts/parity.mjs', 'test/parity/baselines/m5/a.phone.json'); f.git('commit', '-qm', 'metadata');
      const second = f.git('rev-parse', 'HEAD'); expect(runtimeTree(f.root, second)).toBe(key);
      const b = await cachedTree(f.root, second, join(f.root, 'cache'), build);
      expect(b.hit).toBe(true); expect(builds).toBe(1);
      expect(readFileSync(join(b.fixtures, 'test/parity/baselines/m5/a.phone.json'), 'utf8')).toContain('second'); b.cleanup();
      f.put('src/engine/shared.ts', 'export const shared=2;'); f.git('add', 'src/engine/shared.ts'); f.git('commit', '-qm', 'runtime');
      expect(runtimeTree(f.root, f.git('rev-parse', 'HEAD'))).not.toBe(key);
    } finally { f.close(); }
  });
  it('publishes one build for concurrent callers and recovers after a failed build', async () => {
    const f = fixture(); let builds = 0;
    try {
      const sha = f.git('rev-parse', 'HEAD'), cache = join(f.root, 'cache');
      await expect(cachedTree(f.root, sha, cache, () => { throw new Error('failed build'); })).rejects.toThrow('failed build');
      const build = async (tree: string) => { builds++; await Promise.resolve(); mkdirSync(join(tree, 'dist')); writeFileSync(join(tree, 'dist/version.json'), '{}'); };
      const results = await Promise.all([cachedTree(f.root, sha, cache, build), cachedTree(f.root, sha, cache, build)]);
      expect(builds).toBe(1); expect(results.map((r) => r.hit).sort((a,b)=>Number(a)-Number(b))).toEqual([false, true]); results.forEach((r) => { r.cleanup(); });
    } finally { f.close(); }
  });
});

describe('P1 fast selection', () => {
  it('prioritizes changed shards, then reachable shared systems, with rotating coverage on ties', () => {
    const f = fixture(); const shards = ['a', 'b', 'c', 'd'];
    try {
      expect(fastSelection(f.root, shards, ['src/shards/d/content.ts', 'src/engine/only-a.ts'], 0).map((r) => r.shard)).toEqual(['d', 'a']);
      expect(fastSelection(f.root, shards, ['src/engine/shared.ts'], 0).map((r) => r.shard)).toEqual(['a', 'b']);
      expect(fastSelection(f.root, shards, ['src/engine/shared.ts'], 2).map((r) => r.shard)).toEqual(['c', 'd']);
      const path = join(f.root, 'rotation.json'); expect(nextRotation(path)).toBe(0); expect(nextRotation(path)).toBe(2);
    } finally { f.close(); }
  });
});

describe('P1 telemetry observation', () => {
  const envelope = (keys: Record<string, unknown>) => JSON.stringify({ keys });
  it('ignores only telemetry changes and preserves gameplay/mixed/deletion/malformed writes', () => {
    const before = envelope({ 'telemetry.heartbeat': 1, quest: 2 });
    expect(telemetryOnlyWrite(before, envelope({ 'telemetry.heartbeat': 3, quest: 2 }), 'wildshard.save.v2.device')).toBe(true);
    expect(telemetryOnlyWrite(before, envelope({ 'telemetry.heartbeat': 3, quest: 4 }), 'wildshard.save.v2.device')).toBe(false);
    expect(telemetryOnlyWrite(before, envelope({ 'telemetry.heartbeat': 3 }), 'wildshard.save.v2.device')).toBe(false);
    expect(telemetryOnlyWrite(before, envelope({ 'telemetry.heartbeat': 3, quest: 2 }), 'wildshard.save.v2.global')).toBe(false);
    expect(telemetryOnlyWrite(envelope({'life.alive': 1}), envelope({'life.alive': 2}), 'wildshard.save.v2.session')).toBe(true);
    expect(telemetryOnlyWrite(before, 'broken', 'wildshard.save.v2.session')).toBe(false);
  });
  it('limits the proof-only preview fixture to recognized telemetry POST bodies', () => {
    const payload={kind:'analytics',build:'proof-sha',install:'anonymous',events:[{name:'weapon.used',data:{weapon:'bow'}}]};
    expect(telemetryFixtureAccepts('POST',payload)).toBe(true);
    expect(telemetryFixtureAccepts('GET',payload)).toBe(false);
    expect(telemetryFixtureAccepts('POST',{...payload,events:[{name:'unknown',data:{}}]})).toBe(false);
    expect(telemetryFixtureAccepts('POST',{kind:'analytics'})).toBe(false);
    expect(telemetryFixtureAccepts('POST',{...payload,events:[{name:'boss.attempt',data:{outcome:'invalid'}}]})).toBe(false);
    expect(telemetryFixtureAccepts('POST',{...payload,kind:'session',heartbeat:{session:'proof'},end:'clean'})).toBe(true);
    expect(telemetryFixtureAccepts('POST',{...payload,kind:'session',heartbeat:{session:'proof'},end:'invalid'})).toBe(false);
  });
});

describe('P1 capture-frame driver', () => {
  it.each([30,60])('preserves exact simulation steps with %i Hz wall-timer pacing and paused callbacks', async (timerHz) => {
    const native = new Map<number, FrameRequestCallback>(), messages: (() => void)[] = [];
    const listeners = new Map<string, () => void>(); let nativeId = 0, frameNo = 0;
    const wallTimers = new Map<number, TimerHandler>(); let timerId = 0;
    const control: { free: boolean; remaining: number; cpu: number; on: boolean; advance: (n: number) => Promise<void>;
      wait?: (n: number) => Promise<void>; observe?: (fn: () => void) => () => void } = {
      free: false, remaining: 0, cpu: 0, on: false, advance: () => Promise.reject(new Error('not ready')),
    };
    const world = { game: { get frameNo() { return frameNo; } } };
    const window = { __parity: control, __wildshard: { requireWorld: () => world },
      setTimeout: (handler: TimerHandler, _delay?: number, ..._args: unknown[]) => { wallTimers.set(++timerId, handler); return timerId; },
      setInterval: (handler: TimerHandler, _delay?: number, ..._args: unknown[]) => { wallTimers.set(++timerId, handler); return timerId; },
      clearTimeout: (id?: number) => { if (id !== undefined) wallTimers.delete(id); },
      clearInterval: (id?: number) => { if (id !== undefined) wallTimers.delete(id); },
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This fixture implements the browser rAF callback API.
      requestAnimationFrame: (callback: FrameRequestCallback) => { native.set(++nativeId, callback); return nativeId; },
      cancelAnimationFrame: (id: number) => { native.delete(id); } };
    class Channel {
      port1: { onmessage: (() => void) | null } = { onmessage: null };
      port2 = { postMessage: () => { messages.push(() => { this.port1.onmessage?.(); }); } };
    }
    runInNewContext(`(${installFrameDriver.toString()})({accelerated:true,timerHz:${timerHz}})`, { window, MessageChannel: Channel,
      performance: { now: () => 0 }, document: {
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This fixture implements the browser event callback API.
      addEventListener: (name: string, callback: () => void) => { listeners.set(name, callback); } } });
    let paused = false; const timestamps: number[] = [];
    const loop = (time: number) => {
      window.requestAnimationFrame(loop);
      if (!paused && (control.free || control.remaining > 0)) { if (!control.free) control.remaining--; frameNo++; timestamps.push(time); }
    };
    const fired: string[] = [];
    window.setTimeout(() => { fired.push('boot migrated'); }, 100);
    expect(wallTimers.size).toBe(1);
    window.requestAnimationFrame(loop); listeners.get('ws:ready')?.();
    expect(wallTimers.size).toBe(0);
    window.setTimeout(() => { fired.push('toast expired'); }, 100);
    const cancelled = window.setTimeout(() => { fired.push('cancelled'); }, 100); window.clearInterval(cancelled);
    let intervalTicks = 0; const repeating = window.setInterval(() => { intervalTicks++; }, 60);
    let samples = 0; control.observe?.(() => { samples++; });
    const advancing = control.advance(4);
    while (messages.length > 0) messages.shift()?.(); await advancing;
    expect(frameNo).toBe(4); expect(samples).toBe(4); expect(timestamps[3]).toBeCloseTo(4 * 1000 / 30);
    expect(fired).toEqual(timerHz===30?['boot migrated', 'toast expired']:[]); expect(intervalTicks).toBe(timerHz===30?2:1); window.clearTimeout(repeating);
    paused = true; control.free = true;
    if (!control.wait) throw new Error('wait not installed');
    const waiting = control.wait(60); for (let n = 0; n < 60; n++) messages.shift()?.(); await waiting; control.free = false; while (messages.length > 0) messages.shift()?.();
    expect(frameNo).toBe(4); expect(control.remaining).toBe(0);
    expect(fired).toEqual(['boot migrated','toast expired']);
    expect(native.size).toBe(1);
  });
});
