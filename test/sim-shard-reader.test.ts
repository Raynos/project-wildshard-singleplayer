import { expect, test } from 'vitest';
import { downloadEvidence, recoveredGridControls, requireCompiledEntry, transportEvidence, waitForWaitingWorker } from '../scripts/loading-benchmark/sim-shard.mjs';

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
