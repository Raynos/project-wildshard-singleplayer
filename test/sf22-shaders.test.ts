import { expect, it } from 'vitest';
import { shaderCompilationGate } from '../scripts/sf22-shaders.mjs';

const warm = { start: 10, end: 12, phase: 'explicit-warm-up' };

it('excludes explicit warm-up only with a measured task bound, keeping raw counts and censored maxima', () => {
  expect(shaderCompilationGate([warm], [], true)).toMatchObject({
    pass: true, totalCalls: 1, explicitWarmUpCalls: 1, drawOrDriverCalls: 0,
    observedMaxWarmUpTaskMs: null, maxWarmUpTaskMsUpperBound: 50, observerThresholdMs: 50,
  });
  expect(shaderCompilationGate([warm], [], false)).toMatchObject({ pass: false, maxWarmUpTaskMsUpperBound: null });
  expect(shaderCompilationGate([warm], [], true, 49.9).pass).toBe(false);
});

it('fails a warm-up long task above the unchanged limit and does not charge an unrelated long task', () => {
  expect(shaderCompilationGate([warm], [{ start: 0, end: 50, duration: 50 }], true).pass).toBe(true);
  expect(shaderCompilationGate([warm], [{ start: 0, end: 50.01, duration: 50.01 }], true)).toMatchObject({
    pass: false, observedMaxWarmUpTaskMs: 50.01, maxWarmUpTaskMsUpperBound: 50.01,
  });
  expect(shaderCompilationGate([warm], [{ start: 12, end: 74, duration: 62 }], true).pass).toBe(false);
  expect(shaderCompilationGate([warm], [{ start: 13, end: 75, duration: 62 }], true).pass).toBe(true);
});

it('requires zero draw/driver and unclassified calls even if they are short, and refuses invalid observation', () => {
  expect(shaderCompilationGate([warm, { ...warm, phase: 'draw-or-driver' }], [], true)).toMatchObject({ pass: false, drawOrDriverCalls: 1 });
  expect(shaderCompilationGate([{ ...warm, phase: 'unknown' }], [], true)).toMatchObject({ pass: false, unclassifiedCalls: 1 });
  expect(shaderCompilationGate([{ ...warm, start: Number.NaN }], [], true).pass).toBe(false);
  expect(shaderCompilationGate([warm], [{ start: 0, end: 60, duration: Number.NaN }], true).pass).toBe(false);
  expect(shaderCompilationGate([], [], false).pass).toBe(false);
});
