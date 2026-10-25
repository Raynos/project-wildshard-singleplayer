import { expect, test } from 'vitest';
import { compiledEntryQualification, compiledFrameMetrics, compiledPollDetails, downloadEvidence, recoveredGridControls, requireCompiledEntry, sampleCompiledFrame, transportEvidence, waitForWaitingWorker, type CompiledFrameWindow } from '../scripts/loading-benchmark/sim-shard.mjs';

const frameWindow = (): CompiledFrameWindow => ({ controlsAt: null, last: null, worst: 0, worstAt: null, frames: 0, complete: false });

test('post-controls polls stop reading the resource bank but still report late application errors', () => {
  let resourceReads = 0, measureReads = 0;
  const errors: string[] = [];
  const accuracy = { errors, get resources() { resourceReads++; return [{name: '/assets/world.glb', detail: 'x'.repeat(16384)}]; } };
  const measures = () => { measureReads++; return [{name: 'prepare', start: 1, ms: 2}]; };
  const initial = JSON.stringify(compiledPollDetails(true, accuracy, measures));
  expect(initial.length).toBeGreaterThan(16384);
  for (let poll = 0; poll < 16; poll++) {
    expect(JSON.stringify(compiledPollDetails(false, accuracy, measures))).toBe('{"errors":[]}');
  }
  errors.push('Late render failure');
  expect(compiledPollDetails(false, accuracy, measures)).toEqual({errors: ['Late render failure']});
  expect(initial).toContain('"errors":[]');
  expect(resourceReads).toBe(1); expect(measureReads).toBe(1);
  expect(compiledPollDetails(false, null, measures)).toEqual({errors: []});
});

test('compiled qualification retains the observed cold miss even when the median passes', () => {
  expect(compiledEntryQualification([81, 372, 81].map(worstFrameAfterControlsMs => ({worstFrameAfterControlsMs}))))
    .toEqual({ frameLimitMs: 100, complete: true, passed: false, worstFrameAfterControlsMs: 372, exitCode: 2 });
  expect(compiledEntryQualification([{worstFrameAfterControlsMs: 100}]))
    .toMatchObject({ complete: true, passed: true, exitCode: 0 });
  expect(compiledEntryQualification([{worstFrameAfterControlsMs: 101}]))
    .toMatchObject({ complete: true, passed: false, exitCode: 2 });
});

test('compiled refusals and missing frame evidence remain incomplete rather than a measured miss', () => {
  for (const rows of [[], [{}], [{worstFrameAfterControlsMs: Number.NaN}], [{worstFrameAfterControlsMs: -1}],
    [{worstFrameAfterControlsMs: 372}, {error: 'compiled entry never reached controls'}]]) {
    expect(compiledEntryQualification(rows)).toEqual({ frameLimitMs: 100, complete: false, passed: false,
      worstFrameAfterControlsMs: null, exitCode: 1 });
  }
});

test('compiled entry measures the full post-controls window without charging loading or shifting controls', () => {
  const state = frameWindow();
  sampleCompiledFrame(state, 100, false); sampleCompiledFrame(state, 900, false);
  expect(() => compiledFrameMetrics(state, 10000, 10000)).toThrow('Incomplete');
  sampleCompiledFrame(state, 1000, true);
  sampleCompiledFrame(state, 1016, true); sampleCompiledFrame(state, 1216, true);
  for (let at = 1232; at <= 9000; at += 16) sampleCompiledFrame(state, at, true);
  sampleCompiledFrame(state, 9000, true);
  expect(compiledFrameMetrics(state, 10000, 10000)).toMatchObject({ controlsMs: 1000,
    worstFrameAfterControlsMs: 200, worstFrameAfterControlsAtMs: 216, postControlsWindowMs: 8000, postControlsObservedMs: 8000 });
  const finished = { ...state };
  sampleCompiledFrame(state, 20000, true);
  expect(state).toEqual(finished);
});

test('a compiled frame freezing across the end of the window remains a measured miss', () => {
  const state = frameWindow();
  sampleCompiledFrame(state, 0, true);
  for (let at = 16; at <= 7904; at += 16) sampleCompiledFrame(state, at, true);
  sampleCompiledFrame(state, 8500, true);
  expect(compiledFrameMetrics(state, 10000, 10000)).toMatchObject({ controlsMs: 0, worstFrameAfterControlsMs: 596, postControlsFrames: 495, postControlsObservedMs: 8500 });
  expect(() => sampleCompiledFrame(frameWindow(), Number.NaN, true)).toThrow('clock');
  const incomplete = frameWindow(); sampleCompiledFrame(incomplete, 100, true);
  expect(() => sampleCompiledFrame(incomplete, 99, true)).toThrow('clock');
  expect(() => compiledFrameMetrics(incomplete, 10000, 10000)).toThrow('Incomplete');
  expect(() => compiledFrameMetrics(undefined, 10000, 10000)).toThrow('Incomplete');
});

test('saved-pose upgrade evidence requires real controls and refuses the observed paused-world failure', () => {
  const ready = { origin: 1000, at: 200, bootEntry: { reason: 'reload', saved: true, continuing: true, grid: true },
    world: { entered: true, paused: false, frameGate: true }, loaderVisible: false, title: false, error: null };
  expect(recoveredGridControls(ready)).toBe(true);
  expect(recoveredGridControls(null)).toBe(false);
  expect(recoveredGridControls({})).toBe(false);
  for (const change of [{ reason: 'gpu' }, { reason: 'background' }, { saved: false }, { continuing: false }, { grid: false }]) {
    expect(recoveredGridControls({ ...ready, bootEntry: { ...ready.bootEntry, ...change } })).toBe(false);
  }
  for (const change of [{ entered: false }, { paused: true }, { frameGate: false }]) {
    expect(recoveredGridControls({ ...ready, world: { ...ready.world, ...change } })).toBe(false);
  }
  expect(recoveredGridControls({ ...ready, bootEntry: { ...ready.bootEntry, continuing: false },
    world: { ...ready.world, paused: true } })).toBe(false);
  for (const change of [{ loaderVisible: true }, { title: true }, { error: 'Importing a module script failed' }, { at: Number.NaN }, { origin: Infinity }]) {
    expect(recoveredGridControls({ ...ready, ...change })).toBe(false);
  }
});

test('compiled evidence refuses the legacy route, missing readiness and application failures', () => {
  const ready = { readyAt: 1200, errors: [], final: { path: 'shardfile' } };
  expect(() => requireCompiledEntry('http://localhost/?chunk=sunscar-dunes', 'sunscar-dunes', ready)).not.toThrow();
  expect(() => requireCompiledEntry('http://localhost/?chunk=sunscar-dunes-legacy', 'sunscar-dunes', ready)).toThrow('exact compiled');
  expect(() => requireCompiledEntry('http://localhost/?chunk=sunscar-dunes', 'sunscar-dunes', { ...ready, final: { path: 'legacy' } })).toThrow('exact compiled');
  expect(() => requireCompiledEntry('http://localhost/?chunk=sunscar-dunes', 'sunscar-dunes', { ...ready, readyAt: 0 })).toThrow('finish cleanly');
  expect(() => requireCompiledEntry('http://localhost/?chunk=sunscar-dunes', 'sunscar-dunes', { ...ready, errors: ['module failed'] })).toThrow('finish cleanly');
});

test('download evidence retains regressions, denominator growth and missing measurements', () => {
  expect(downloadEvidence([
    { step: 'modules', declaredBytes: '100', pendingBytes: '50', downloadPercent: '50' },
    { step: 'admission.transport', declaredBytes: '200', pendingBytes: '150', downloadPercent: '25' },
    { step: 'data', declaredBytes: '200', pendingBytes: '100', downloadPercent: '99' },
    {},
  ])).toEqual({ measuredFrames: 3, missingFrames: 1, denominatorChangesAfterAdmission: 1,
    downloadDrops: 1, maxPercentError: 49, finalDeclaredBytes: 200 });
  expect(downloadEvidence([]).maxPercentError).toBeNull();
  expect(downloadEvidence([{ declaredBytes: '100', pendingBytes: '', downloadPercent: '' }]).missingFrames).toBe(1);
});


test('bare painted admission rows start the denominator boundary, while module subphases do not', () => {
  const sample = (step: string, declaredBytes: string) => ({ step, declaredBytes, pendingBytes: '0', downloadPercent: '100' });
  expect(downloadEvidence([sample('modules', '100'), sample('admission', '200'), sample('world', '250')]))
    .toMatchObject({ denominatorChangesAfterAdmission: 2 });
  expect(downloadEvidence([
    sample('modules', '100'), sample('admission.modules', '150'),
    sample('admission', '200'), sample('world', '250'),
  ])).toMatchObject({ denominatorChangesAfterAdmission: 2, downloadDrops: 0, maxPercentError: 0 });
  expect(downloadEvidence([sample('modules', '100'), sample('admission.modules', '150'), sample('world', '200')]))
    .toMatchObject({ denominatorChangesAfterAdmission: 0 });
});

test('the reader refuses to conflate content, cached content and compressed traffic', () => {
  expect(transportEvidence([{ bodyBytes: 10, decodedBodyBytes: 100 }, { bodyBytes: 20, decodedBodyBytes: 20 }])).toMatchObject({
    wireBodyBytes: 30, networkContentBytes: 120, unknownContentResponses: 0, responses: 2 });
  expect(transportEvidence([{ bodyBytes: 10 }])).toMatchObject({ wireBodyBytes: 10, networkContentBytes: null, unknownContentResponses: 1 });
});


test('upgrade state observation waits for the same installed candidate without starting another install', async () => {
  const worker = {state: 'installing' as ServiceWorkerState};
  const registration: {waiting: typeof worker | null; installing: typeof worker | null} = {waiting: null, installing: worker};
  const pending = waitForWaitingWorker(registration, 500);
  worker.state = 'installed'; registration.waiting = worker; registration.installing = null;
  expect(await pending).toBe(worker);
  expect(await waitForWaitingWorker(registration)).toBe(worker);
});

test('upgrade state observation refuses replacement, retirement and deadline', async () => {
  const worker = {state: 'installing' as ServiceWorkerState};
  const registration = {waiting: null, installing: worker};
  const replaced = waitForWaitingWorker(registration, 500);
  registration.installing = {state: 'installing'};
  await expect(replaced).rejects.toThrow('candidate changed');
  const retired = waitForWaitingWorker({waiting: null, installing: {state: 'redundant'}}, 500);
  await expect(retired).rejects.toThrow('redundant');
  await expect(waitForWaitingWorker({waiting: null, installing: worker}, 10)).rejects.toThrow('deadline');
  await expect(waitForWaitingWorker({waiting: null, installing: null})).rejects.toThrow('No new worker');
});
