import { expect, test } from 'vitest';
import { admissionFrameEvidence, compiledTimingHistory, compiledDocumentEvidence, compiledEntryQualification, compiledFrameMetrics, compiledPollDetails, compiledVisibleFailure, compiledPreviewEnvironment, downloadEvidence, recoveredGridControls, requireCompiledEntry, sampleCompiledFrame, stepEvidence, stepBoundaryEvidence, transportEvidence, waitForWaitingWorker, type CompiledFrameWindow } from '../scripts/loading-benchmark/sim-shard.mjs';
import type { AdmissionFrames } from '../scripts/loading-benchmark/accuracy-data.d.mts';

const frameWindow = (): CompiledFrameWindow => ({ controlsAt: null, last: null, worst: 0, worstAt: null, frames: 0, complete: false });

test('reader preview leases are distinct from their launcher and other readers', () => {
  const environment = {SERVE_OWNER: 'parent-preview', SERVE_REG_DIR: '/owned-registry'};
  const first = compiledPreviewEnvironment(environment, 123);
  expect(first.SERVE_OWNER).not.toBe(environment.SERVE_OWNER);
  expect(first.SERVE_OWNER).not.toBe(compiledPreviewEnvironment(environment, 124).SERVE_OWNER);
  expect(first.SERVE_OWNER).toBe(compiledPreviewEnvironment(environment, 123).SERVE_OWNER);
  expect(first['SERVE_REG_DIR']).toBe(environment.SERVE_REG_DIR);
  expect(environment).toEqual({SERVE_OWNER: 'parent-preview', SERVE_REG_DIR: '/owned-registry'});
  expect(compiledPreviewEnvironment({}, 123).SERVE_OWNER).not.toBe('sim-grid-entry');
});

test('a visible warm boot fault refuses without depending on accuracy injection or state capture', async () => {
  let reads = 0;
  const read = () => { reads++; return Promise.resolve({accuracy: null, stack: 'actual asset caller'}); };
  expect(await compiledVisibleFailure({}, read)).toBeNull();
  for (const error of [null, '', '  ']) expect(await compiledVisibleFailure({error}, read)).toBeNull();
  expect(reads).toBe(0);
  const error = 'Error: Unavailable or oversized shardfile asset';
  expect(await compiledVisibleFailure({error}, read)).toEqual({error, state: {accuracy: null, stack: 'actual asset caller'}});
  expect(reads).toBe(1);
  const failure = await compiledVisibleFailure({error}, () => Promise.reject(new Error('Inspector disconnected')));
  expect(failure).toEqual({error, state: null, captureError: 'Error: Inspector disconnected'});
  expect(compiledEntryQualification([{error: failure?.error ?? 'missing failure'}])).toMatchObject({complete: false, exitCode: 1});
});

test('step boundaries use retained first-entry facts, including steps missed by sampled rows', () => {
  const report = stepBoundaryEvidence({at: 1100, elapsedMs: 1000, fading: true, rows: [
    {key: 'first', startedAt: '100', setupAtStart: '0'},
    {key: 'short', startedAt: '350', setupAtStart: '40'},
    {key: 'gap', startedAt: '', setupAtStart: ''},
    {key: 'gap', startedAt: '', setupAtStart: ''},
    {key: 'last', startedAt: '900', setupAtStart: '80'},
  ]});
  expect(report).toMatchObject({complete: true, reason: null, executedRows: 3, measuredStarts: 3,
    missingStarts: [], maxErrorPoints: 15, within15Points: true});
  expect(report.starts[1]).toEqual({key: 'short', startedAt: 350, setup: 40, elapsedPercent: 25, errorPoints: 15});
});

test('step boundaries keep missing coverage unknown while retaining a measured miss', () => {
  const final = {at: 1100, elapsedMs: 1000, fading: true};
  const unknown = {key: 'modules', startedAt: '100'};
  const known = {key: 'short', startedAt: '350', setupAtStart: '25'};
  expect(stepBoundaryEvidence({...final, rows: [unknown, known]})).toMatchObject({complete: false,
    reason: 'missing step facts', executedRows: 2, measuredStarts: 1, missingStarts: ['modules'], within15Points: null});
  expect(stepBoundaryEvidence({...final, rows: [unknown, {...known, setupAtStart: '41'}]}))
    .toMatchObject({complete: false, maxErrorPoints: 16, within15Points: false});
  for (const sample of [undefined, null, {}, {...final, fading: false}, {...final, elapsedMs: 0},
    {...final, elapsedMs: Number.NaN}, {...final, at: 900}, {...final, rows: []}])
    expect(stepBoundaryEvidence(sample)).toMatchObject({complete: false, within15Points: null});
});

test('step boundaries refuse invalid clocks, percentages, duplicate rows and unbounded lists', () => {
  const final = {at: 1100, elapsedMs: 1000, fading: true};
  const row = {key: 'world', startedAt: '500', setupAtStart: '40'};
  for (const bad of [{...row, startedAt: '99'}, {...row, startedAt: '1101'}, {...row, startedAt: 'NaN'},
    {...row, setupAtStart: '-1'}, {...row, setupAtStart: '101'}, {...row, setupAtStart: '4.5'}])
    expect(() => stepBoundaryEvidence({...final, rows: [bad]})).toThrow('step boundary');
  expect(() => stepBoundaryEvidence({...final, rows: [row, row]})).toThrow('Duplicate step boundary');
  expect(() => stepBoundaryEvidence({...final, rows: Array.from({length: 257}, () => row)})).toThrow('step boundary rows');
});

test('admission callback evidence preserves unknowns, blank facts and incomplete coverage', () => {
  const record = (): AdmissionFrames => ({protocol: 'loading-admission-raf/1', frames: 2, droppedFrames: 0,
    truncatedFrames: 0, maxGapMs: 16, endedAt: 50, runs: [{firstAt: 10, lastAt: 26, frames: 2,
      step: 'admission', footer: '', waiting: '', filesInFlight: ''}]});
  expect(admissionFrameEvidence(record())).toEqual({callbackRecordComplete: true, reason: null, observedFrames: 2, blankFooterFrames: 2});
  expect(admissionFrameEvidence(undefined)).toMatchObject({callbackRecordComplete: false, reason: 'missing', blankFooterFrames: null});
  expect(admissionFrameEvidence({...record(), endedAt: null})).toMatchObject({callbackRecordComplete: false, reason: 'unfinished'});
  expect(admissionFrameEvidence({...record(), frames: 3, droppedFrames: 1})).toMatchObject({callbackRecordComplete: false, reason: 'overflow', blankFooterFrames: null});
  expect(admissionFrameEvidence({...record(), truncatedFrames: 1})).toMatchObject({callbackRecordComplete: false, reason: 'truncated', blankFooterFrames: null});
  for (const patch of [{frames: 3}, {endedAt: 20}, {maxGapMs: -1}, {truncatedFrames: 3}])
    expect(() => admissionFrameEvidence({...record(), ...patch})).toThrow('admission frame');
});

test('compiled timing evidence retains only the persisted selected path', () => {
  const key = 'path:v3:phone:shardfile:sunscar-dunes';
  const values = { loadout: 80, gameplay: 202.5 };
  const read = () => JSON.stringify({keys: {other: {data: 'private'}, 'boot.times': {v: 1, data: {
    [key]: values, 'path:v3:desktop:shardfile:sunscar-dunes': {gameplay: 999}, legacy: {world: 777},
  }}}});
  expect(compiledTimingHistory(read, 'sunscar-dunes')).toEqual({key, values});
  expect(JSON.stringify(compiledTimingHistory(read, 'sunscar-dunes'))).not.toMatch(/private|legacy|999/u);
  for (const readMissing of [() => null, () => '{"keys":{}}', read]) {
    expect(compiledTimingHistory(readMissing, 'missing').values).toBeNull();
    expect(compiledTimingHistory(readMissing, 'missing').error).toBeUndefined();
  }
});

test('compiled timing evidence names denied, malformed and unbounded reads', () => {
  const key = 'path:v3:phone:shardfile:sunscar-dunes';
  for (const raw of ['{', 'x'.repeat(1024 * 1024 + 1), ...[null, [], {gameplay: 0}, {gameplay: '12'},
    Object.fromEntries(Array.from({length: 65}, (_, n) => [String(n), 1]))].map(values => JSON.stringify({keys: {'boot.times': {v: 1, data: {[key]: values}}}})),
    '{"keys":{"boot.times":{"v":2,"data":{}}}}']) {
    const evidence = compiledTimingHistory(() => raw, 'sunscar-dunes');
    expect(evidence).toMatchObject({key, values: null});
    expect(typeof evidence.error).toBe('string');
  }
  expect(compiledTimingHistory(() => {throw new Error('Storage denied');}, 'sunscar-dunes').error).toContain('Storage denied');
});

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

test('compiled document identity records the observed one-millisecond Safari origin drift', () => {
  const first = {origin: 1792948830448, documentToken: 'same-live-document'};
  expect(compiledDocumentEvidence(first, {...first, origin: 1792948830449}))
    .toEqual({token: 'same-live-document', timeOrigin: first.origin, originDriftMs: 1});
  expect(compiledDocumentEvidence(first, {...first, origin: first.origin - 1}).originDriftMs).toBe(-1);
  expect(() => compiledDocumentEvidence(first, {...first, documentToken: 'replacement-document'})).toThrow('changed document');
  expect(() => compiledDocumentEvidence(first, {origin: first.origin})).toThrow('identity');
  expect(() => compiledDocumentEvidence({origin: first.origin}, {origin: first.origin})).toThrow('identity');
  expect(() => compiledDocumentEvidence(first, {...first, origin: Number.NaN})).toThrow('identity');
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

test('compiled step evidence retains denominator changes and backwards numbers', () => {
  const sample = (detail: string, setup: string, clock: string, fading = false) => ({detail, setup, clock, fading});
  const report = stepEvidence([
    sample('Loading application modules', '', '00:00.0'),
    sample('step 1 / 3 · Modules', '0', '00:00.0'),
    sample('step 1 / 3 · Modules', '10', '00:00.5'),
    sample('step 2 / 3 · World', '25', '00:02.0'),
    sample('step 1 / 4 · Modules', '60', '00:03.0'),
    sample('gap after World', '94', '00:03.9'),
    sample('gap after World', '100', '00:04.0', true),
  ]);
  expect(report).toEqual({numberedFrames: 4, totalSteps: 4, totalChanges: 1, numberRegressions: 1,
    lastSetupBeforeFade: 94, observedStarts: [
      {number: 1, total: 3, setup: 0, elapsedPercent: 0, errorPoints: 0},
      {number: 2, total: 3, setup: 25, elapsedPercent: 50, errorPoints: 25},
      {number: 1, total: 4, setup: 60, elapsedPercent: 75, errorPoints: 15},
    ]});
});

test('step evidence does not invent skipped step starts, clocks or pre-fade completion', () => {
  expect(stepEvidence([])).toEqual({numberedFrames: 0, totalSteps: null, totalChanges: 0,
    numberRegressions: 0, observedStarts: [], lastSetupBeforeFade: null});
  expect(stepEvidence([{detail: 'step 5 / 26 · Audio', setup: '', clock: 'bad', fading: true}]))
    .toMatchObject({numberedFrames: 1, lastSetupBeforeFade: null,
      observedStarts: [{number: 5, total: 26, setup: null, elapsedPercent: null, errorPoints: null}]});
  expect(stepEvidence([{detail: 'step 4 / 3 · Invalid', setup: 'NaN'}]).numberedFrames).toBe(0);
});

test('step evidence retains monotonic sample ratios separately from the rounded display clock', () => {
  const first = {detail: 'step 2 / 3 · Admission', setup: '13', clock: '00:00.1', elapsedMs: 125, fading: false};
  const last = {detail: 'gap after World', setup: '100', clock: '00:01.0', elapsedMs: 1000, fading: true};
  expect(stepEvidence([first, last]).observedStarts).toEqual([{number: 2, total: 3, setup: 13,
    elapsedPercent: 10, errorPoints: 3, pageElapsedPercent: 12.5, pageErrorPoints: 0.5}]);
  for (const elapsedMs of [-1, 1001, Number.NaN, Infinity]) {
    const report = stepEvidence([{...first, elapsedMs}, last]);
    expect(report.observedStarts[0]?.pageElapsedPercent).toBeUndefined();
  }
  expect(stepEvidence([{detail: first.detail, setup: first.setup, clock: first.clock}, last]).observedStarts[0]?.pageElapsedPercent).toBeUndefined();
});

test('a missing or invalid completion clock cannot manufacture a precise step ratio', () => {
  const first = {detail: 'step 2 / 3 · Admission', setup: '25', clock: '00:00.2', elapsedMs: 200};
  const final = {detail: 'gap after World', setup: '100', clock: '00:01.0', fading: true};
  for (const elapsedMs of [undefined, null, 0, -1, Number.NaN, Infinity]) {
    const last = elapsedMs === undefined ? final : {...final, elapsedMs};
    const report = stepEvidence([first, last]).observedStarts[0];
    expect(report).toMatchObject({elapsedPercent: 20, errorPoints: 5});
    expect(report).not.toHaveProperty('pageElapsedPercent');
    expect(report).not.toHaveProperty('pageErrorPoints');
  }
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
