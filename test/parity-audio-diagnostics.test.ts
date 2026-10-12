// oxlint-disable-next-line import/no-nodejs-modules -- Verify owned failure artifacts using real fixture files.
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Allocate disposable Node fixture directories.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct the owned fixture artifact path.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Prove the browser-serialized function has no module closure.
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { publishAudioDiagnostics, rememberAudioBoundary, sampleAudioBoundary } from '../scripts/parity/audio-diagnostics.mjs';

const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) rmSync(dir, {recursive:true, force:true}); });

it('copies bounded readiness evidence without graph construction, sound drains or RNG draws', () => {
  const samples = {set:'test', loops:Array.from({length:100}, (_, i) => `loop${i}`),
    oneshots:Array.from({length:100}, (_, i) => `shot${i}`), sampleBed:false, underSample:false};
  const audio = {ready:false, muted:true, worldMuted:true, samples,
    census:() => ({activeVoices:0, beds:0, buses:0})};
  const music = {scoreId:'test', state:{mode:'day', intensity:0, underwater:false}, isPlaying:true};
  for (const target of [audio, music]) for (const key of ['ctx', 'master', 'engine', 'out', 'stats', 'resume', 'play']) {
    Object.defineProperty(target, key, {get:() => { throw new Error(`Diagnostic built ${key}`); }});
  }
  const randomState = {version:1, seed:7, streams:[{name:'actors', state:{state:8, initial:7, scrambledFork:false}}]};
  const world = {audio, music, game:{levelScope:{name:'parent', disposed:false, census:{sounds:0, timers:2, disposers:3}},
    app:{clock:{now:1, real:2, frame:30, mode:'capture'}, rng:{snapshot:() => structuredClone(randomState)}}}};
  const log = Array.from({length:400}, (_, t) => ({t, kind:'wire', name:`cue${t}`, ok:false, detail:'x'.repeat(1000)}));
  const before = JSON.stringify({samples, randomState, log});
  const fakeWindow = {__wildshard:{requireWorld:() => world, sounds:() => { throw new Error('Counters drained'); }}, __audioLog:log};
  // Playwright serializes this function into a page; it must need no module closure or injected helper.
  const sample: unknown = runInNewContext(`(${sampleAudioBoundary.toString()})()`, {
    window:fakeWindow, Math:new Proxy(Math, {get:(target, key) => {
      if (key === 'random') throw new Error('Random draw');
      const value: unknown = Reflect.get(target, key); return value;
    }}),
  });
  expect(sample).toMatchObject({graphReady:false, music:{playingOrQueued:true},
    mixer:{loopCount:100, shotCount:100, loops:samples.loops.slice(0,16), shots:samples.oneshots.slice(0,16)},
    parentScope:{name:'parent', disposed:false, timers:2}, namedRng:{seed:7, streamCount:1},
    log:log.slice(-16).map(entry => ({t:entry.t, kind:entry.kind, name:entry.name, ok:entry.ok, detail:entry.detail.slice(0,160)}))});
  expect(JSON.stringify({samples, randomState, log})).toBe(before);
});

it('emits a bounded final-red sidecar without adding compared fields and removes it after green', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parity-audio-')); dirs.push(dir);
  const path = join(dir, 'audio.json'), first = {boot:{shard:'nine'}}, middle = {boot:{shard:'nine'}}, retry = {boot:{shard:'nine'}};
  const before = JSON.stringify([first, middle, retry]);
  for (let i = 0; i < 6; i++) rememberAudioBoundary(first, `boundary${i}`, {graphReady:false});
  rememberAudioBoundary(retry, 'after-combat', {graphReady:true});
  rememberAudioBoundary(middle, 'middle-run', {graphReady:false});
  expect(existsSync(path)).toBe(false);
  publishAudioDiagnostics(path, [first, middle, retry], true);
  const payload: unknown = JSON.parse(readFileSync(path, 'utf8'));
  expect(payload).toMatchObject({schema:1, limits:{runs:2, boundaries:4, bytes:65536},
    runs:[Array.from({length:4}, (_, i) => ({boundary:`boundary${i}`, observation:{graphReady:false}})),
      [{boundary:'after-combat', observation:{graphReady:true}}]]});
  expect(JSON.stringify([first, middle, retry])).toBe(before);
  publishAudioDiagnostics(path, [first, middle, retry], false);
  expect(existsSync(path)).toBe(false);
});

it('refuses oversized diagnostic history without changing the existing report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parity-audio-')); dirs.push(dir);
  const path = join(dir, 'audio.json'), report = {verdict:'red'};
  rememberAudioBoundary(report, 'oversized', 'x'.repeat(70_000));
  publishAudioDiagnostics(path, [report], true);
  expect(readFileSync(path).byteLength).toBeLessThan(65536);
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({unavailable:'Diagnostic byte limit exceeded'});
  expect(report).toEqual({verdict:'red'});
});
