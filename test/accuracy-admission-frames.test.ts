// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the serialized browser fixture without a browser or Simulator.
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { accuracyRecorder } from '../scripts/loading-benchmark/accuracy-data.mjs';

function fixture() {
  let now = 0;
  const frames: FrameRequestCallback[] = [], intervals: (() => void)[] = [];
  class Element {
    dataset: Record<string, string> = {path: 'shardfile', step: 'modules', startedAt: '0'};
    footer = ''; fading = false; rowReads = 0;
    rows: {dataset: Record<string, string>; className: string;
      children: {item: (index: number) => {textContent: string} | null}}[] = [];
    classList = {contains: (name: string) => name === 'hide' && this.fading};
    querySelector(selector: string) { return {textContent: selector === '[data-el="foot"]' ? this.footer : ''}; }
    querySelectorAll() { this.rowReads++; return this.rows; }
  }
  const root = new Element(), window = {addEventListener: () => undefined};
  const page = {window, HTMLElement: Element, performance: {now: () => now},
    navigator: {serviceWorker: {addEventListener: () => undefined}},
    document: {querySelector: () => root, addEventListener: () => undefined},
    PerformanceObserver: class { observe() { /* No resources in this DOM fixture. */ } },
    setInterval: (run: () => void) => { intervals.push(run); },
    requestAnimationFrame: (run: FrameRequestCallback) => { frames.push(run); return frames.length; }};
  runInNewContext(`(${accuracyRecorder.toString()})();`, page, {timeout: 1000});
  return {root, frame(at: number) { now = at; for (const run of frames.splice(0)) run(at); },
    finish() { root.fading = true; for (const run of intervals) run(); },
    pending: () => frames.length, state: (): unknown => Reflect.get(window, '__loadingAccuracy')};
}

test('serialized admission recorder retains every frame fact without repeating full loading rows', () => {
  const f = fixture();
  f.frame(10); f.root.dataset['step'] = 'admission.modules'; f.frame(20);
  f.root.dataset['step'] = 'admission'; f.root.footer = 'Reading entry.json';
  f.root.dataset['filesInFlight'] = '1'; f.frame(30); f.frame(46); f.frame(62);
  f.root.footer = 'Checking saved a1b2c3'; f.root.dataset['filesInFlight'] = '0'; f.frame(80);
  f.root.dataset['step'] = 'world'; f.frame(100);
  expect(f.root.rowReads).toBe(0);
  f.finish(); f.frame(120);
  expect(f.root.rowReads).toBe(1);
  expect(f.pending()).toBe(0);
  expect(f.state()).toMatchObject({admissionFrames: {protocol: 'loading-admission-raf/1', frames: 4,
    droppedFrames: 0, truncatedFrames: 0, maxGapMs: 18, endedAt: 100, runs: [
      {firstAt: 30, lastAt: 62, frames: 3, step: 'admission', footer: 'Reading entry.json', filesInFlight: '1'},
      {firstAt: 80, lastAt: 80, frames: 1, step: 'admission', footer: 'Checking saved a1b2c3', filesInFlight: '0'},
    ]}});
});

test('admission evidence retains missing facts and refuses to hide bounded-record overflow', () => {
  const f = fixture(); f.root.dataset['step'] = 'admission';
  f.frame(1);
  for (let at = 2; at <= 300; at++) { f.root.footer = `Reading ${at}.bin`; f.frame(at); }
  f.root.footer = 'x'.repeat(1025); f.frame(301); f.finish();
  const runs: unknown = expect.arrayContaining([{firstAt: 1, lastAt: 1, frames: 1,
    step: 'admission', footer: '', waiting: '', filesInFlight: ''}]);
  expect(f.state()).toMatchObject({admissionFrames: {frames: 301, droppedFrames: 45, truncatedFrames: 1,
    runs}});
});

test('identical facts separated by another phase remain separate observed runs', () => {
  const f = fixture(); f.root.dataset['step'] = 'admission'; f.frame(10);
  f.root.dataset['step'] = 'world'; f.frame(20);
  f.root.dataset['step'] = 'admission'; f.frame(30); f.finish();
  expect(f.state()).toMatchObject({admissionFrames: {frames: 2, maxGapMs: 0, endedAt: 30, runs: [
    {firstAt: 10, lastAt: 10, frames: 1}, {firstAt: 30, lastAt: 30, frames: 1},
  ]}});
});

test('a visit without admission never fabricates admission coverage', () => {
  const f = fixture(); f.frame(10); f.finish(); f.frame(20);
  expect(f.state()).toMatchObject({admissionFrames: {frames: 0, endedAt: null, runs: []}});
  expect(f.pending()).toBe(0);
});

test('serialized final rows preserve the declared start clock of a short completed step', () => {
  const f = fixture();
  f.root.rows.push({dataset: {key: 'admission', ms: '0', startedAt: '12'}, className: 'ok',
    children: {item: () => ({textContent: ''})}});
  f.frame(100); f.finish();
  expect(f.state()).toMatchObject({final: {rows: [{key: 'admission', ms: '0', startedAt: '12'}]}});
});
