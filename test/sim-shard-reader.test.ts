import { expect, test } from 'vitest';
import { downloadEvidence, requireCompiledEntry, transportEvidence } from '../scripts/loading-benchmark/sim-shard.mjs';

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


test('the reader refuses to conflate content, cached content and compressed traffic', () => {
  expect(transportEvidence([{ bodyBytes: 10, decodedBodyBytes: 100 }, { bodyBytes: 20, decodedBodyBytes: 20 }])).toMatchObject({
    wireBodyBytes: 30, networkContentBytes: 120, unknownContentResponses: 0, responses: 2 });
  expect(transportEvidence([{ bodyBytes: 10 }])).toMatchObject({ wireBodyBytes: 10, networkContentBytes: null, unknownContentResponses: 1 });
});
