// oxlint-disable-next-line import/no-nodejs-modules -- Tests the exact browser/host source without starting Safari.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A fresh VM models document identity without navigating a real browser.
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { gridFloorRuntimeFailure, installFloorGridProgress, gridFloorDocumentIdentity, type FloorGridProgress } from '../scripts/frame-floor-grid.mjs';

const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
const evaluatorSource = source.slice(source.indexOf('let evalSequence = 0;'), source.indexOf('async function waitReady'));
const last: FloorGridProgress = { documentOrigin: 100, sampledAt: 200, seconds: 12,
  stop: { leg: 'pine-interior', phase: 'travel', waypoint: 0, target: { x: 0, z: 325 } },
  current: 'pine', inside: 'pine', feet: { x: 0, y: 0.55, z: 310 }, gameplayReady: false,
  memory: { modelledMB: 1082, accountedBytes: 705e6, glMB: 206, glReconciled: true,
    claims: [{ id: 'sim:pine', bytes: 501e6 }], cost: { playing: 1082e6 } } };

it('mirrors the last ledger before a document change, rejects the active route and never dispatches it again', async () => {
  const clock = { timeOrigin: 100 }, window: { calls: number; __frameFloorGridProgress: () => FloorGridProgress; __frameFloorGridDocumentToken?: string } = { calls: 0, __frameFloorGridProgress: () => last };
  const context = createContext({ window, performance: clock, crypto: { randomUUID: () => 'document-one' } });
  const observe = vi.fn<(progress: FloorGridProgress) => void>();
  const evaluate = runInNewContext(`${evaluatorSource}\nevaluator`, { gridFloorDocumentIdentity, sleep: () => { clock.timeOrigin = 300; window.__frameFloorGridDocumentToken = 'document-two'; return Promise.resolve(); } }) as
    (raw: (expression: string) => Promise<unknown>, observed: (progress: FloorGridProgress) => void) => (expression: string) => Promise<unknown>;
  const run = evaluate(expression => Promise.resolve(runInContext(expression, context) as unknown), observe);
  await expect(run('(window.calls++, new Promise(() => {}))')).rejects.toThrow('document changed');
  expect(window.calls).toBe(1);
  expect(observe).toHaveBeenCalledExactlyOnceWith(last);
  expect(Object.keys(context).filter(key => key.startsWith('__frameFloorEval'))).toEqual([]);
});

it('still awaits an ordinary promise in the same document', async () => {
  const context = createContext({ window: {}, performance: { timeOrigin: 100 }, crypto: { randomUUID: () => 'document-one' } });
  const evaluate = runInNewContext(`${evaluatorSource}\nevaluator`, { gridFloorDocumentIdentity, sleep: () => Promise.resolve() }) as
    (raw: (expression: string) => Promise<unknown>) => (expression: string) => Promise<unknown>;
  expect(await evaluate(expression => Promise.resolve(runInContext(expression, context) as unknown))('Promise.resolve(42)')).toBe(42);
});

it('records same-document Safari time-origin drift without replaying the expression', async () => {
  const clock = { timeOrigin: 100 }, window = { calls: 0 };
  const context = createContext({ window, performance: clock, crypto: { randomUUID: () => 'document-one' } });
  const host = createContext({ gridFloorDocumentIdentity, sleep: () => Promise.resolve() });
  const evaluate = runInContext(`${evaluatorSource}\nevaluator`, host) as
    (raw: (expression: string) => Promise<unknown>) => (expression: string) => Promise<unknown>;
  let reads = 0;
  const run = evaluate(expression => {
    if (++reads === 2) clock.timeOrigin += 2;
    return Promise.resolve(runInContext(expression, context) as unknown);
  });
  expect(await run('(window.calls++, Promise.resolve(42))')).toBe(42);
  expect(window.calls).toBe(1);
  expect(runInContext('evaluationOriginDriftMaxMs', host)).toBe(2);
});

it('refuses a new document token even if its time origin is identical', async () => {
  const window: { calls: number; __frameFloorGridDocumentToken?: string } = { calls: 0 };
  const context = createContext({ window, performance: { timeOrigin: 100 }, crypto: { randomUUID: () => 'document-one' } });
  const evaluate = runInNewContext(`${evaluatorSource}\nevaluator`, { gridFloorDocumentIdentity,
    sleep: () => { window.__frameFloorGridDocumentToken = 'document-two'; return Promise.resolve(); } }) as
    (raw: (expression: string) => Promise<unknown>) => (expression: string) => Promise<unknown>;
  const run = evaluate(expression => Promise.resolve(runInContext(expression, context) as unknown));
  await expect(run('(window.calls++, new Promise(() => {}))')).rejects.toThrow('document changed');
  expect(window.calls).toBe(1);
});

it('reconnects Safari for evidence after a transport timeout without re-evaluating a gameplay command', async () => {
  const start = source.indexOf('const retryEvaluate = async'), end = source.indexOf('\n      driver = {', start);
  const evaluate = vi.fn(() => Promise.reject(new Error('Web Inspector timed out: Runtime.evaluate')));
  const connect = vi.fn(() => Promise.resolve());
  const run = runInNewContext(`${source.slice(start, end)}\nretryEvaluate`, {
    evaluate, connect, currentUrl: 'http://floor/frame-floor-safari.html', console: { log: () => undefined },
    errorText: (error: Error) => error.message, inspector: { raw: () => Promise.resolve(300) },
  }) as (expression: string, timeout: number) => Promise<unknown>;
  const result = run('moveThePlayer()', 150000);
  await expect(result).rejects.toMatchObject({ documentOrigin: 300 });
  await expect(result).rejects.toThrow('refusing to replay');
  expect(evaluate).toHaveBeenCalledExactlyOnceWith('moveThePlayer()', 150000);
  expect(connect).toHaveBeenCalledOnce();
});

it('grades recovery and navigation as completed FAILs with the original leg and memory, without blaming a stale recovery', () => {
  const failure = gridFloorRuntimeFailure(last, { documentOrigin: 300,
    lastEnd: { reason: 'graphics recovery: the GPU process restarted: every canvas was wiped', at: 290 } });
  expect(failure).toMatchObject({ kind: 'gpu-recovery', stop: last.stop, lastSample: last, nextDocumentOrigin: 300 });
  const gradeSource = source.slice(source.indexOf('function assess('), source.indexOf('function printVerdict'));
  const grade = runInNewContext(`${gradeSource}\ngrade`) as (record: object) => { complete: boolean; pass: boolean };
  const cadence = { pose: { name: 'crossroads' }, medianFps: 30.3, p95Ms: 34, skipped: 0, contextLost: false,
    frames: 120, cpu: { enabled: true, frames: 120, owners: [{ id: 'fixture', p95Ms: 1 }] } };
  expect(grade({ underTenMinutes: true, results: [{ surface: 'sim', rows: [{ complete: true, pass: true, rows: [cadence], errors: [], runtimeFailure: failure }] }] }))
    .toMatchObject({ complete: true, pass: false });
  expect(gridFloorRuntimeFailure(last, { documentOrigin: 300, lastEnd: { reason: 'old GPU recovery', at: 90 } }))
    .toMatchObject({ kind: 'navigation', recoveryReason: 'Document navigated during grid travel; recovery reason unavailable' });
  expect(gridFloorRuntimeFailure(last, { documentOrigin: 100 })).toBeNull();
  expect(gridFloorRuntimeFailure(null, { documentOrigin: 300 })).toBeNull();
});

it('retains one bounded memory ledger, samples real GL separately and preserves it when the context is lost', () => {
  let now = 0, lost = false;
  const census = vi.fn(() => [{ totalBytes: 206e6, reconciled: true }]);
  const claims = [{ id: 'sim:pine', bytes: 501e6 }];
  const window: { __frameFloorGridProgress?: () => FloorGridProgress | null; __frameFloorGridStop: FloorGridProgress['stop']; __wildshard: object; __sc_gl?: typeof census } = {
    __frameFloorGridStop: last.stop, __sc_gl: census, __wildshard: {
      world: { game: { renderer: { getContext: () => ({ isContextLost: () => lost }) } } },
      shard: { grid: { state: () => ({ playingMB: 1082, accountedBytes: 705e6, inside: 'pine', live: { live: { ...last, worldFeet: last.feet } } }),
        residency: () => ({ claims, cost: { playing: 1082e6 } }) } } } };
  runInNewContext(`(${installFloorGridProgress.toString()})()`, { window, performance: { timeOrigin: 100, now: () => now } });
  const read = window.__frameFloorGridProgress;
  if (!read) throw new Error('Missing diagnostic reader');
  const first = read();
  expect(first).toMatchObject({ stop: last.stop, feet: last.feet, current: 'pine', inside: 'pine' });
  expect(first?.memory).toMatchObject({ modelledMB: 1082, accountedBytes: 705e6, glMB: 206, glReconciled: true, claims });
  now = 500; expect(read()).toBe(first); expect(census).toHaveBeenCalledOnce();
  now = 1500; lost = true; expect(read()).toBe(first); expect(census).toHaveBeenCalledOnce();
  lost = false; delete window.__sc_gl;
  expect(read()?.memory.glMB).toBeNull();
});
