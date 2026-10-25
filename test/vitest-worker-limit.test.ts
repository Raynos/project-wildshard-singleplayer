import { expect, test } from 'vitest';
import { vitestMaxWorkers } from '../scripts/vitest-lane';

test('only the serialized local CF1 run defaults to four workers', () => {
  expect(vitestMaxWorkers({})).toBe(2);
  expect(vitestMaxWorkers({ WS_COMMIT_RELATED_TOKEN: '' })).toBe(2);
  expect(vitestMaxWorkers({ WS_COMMIT_RELATED_TOKEN: 'invocation' })).toBe(4);
});

test('CI keeps its runner default even if a CF1 marker is present', () => {
  for (const ci of [{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
    expect(vitestMaxWorkers(ci)).toBeUndefined();
    expect(vitestMaxWorkers({ ...ci, WS_COMMIT_RELATED_TOKEN: 'invocation' })).toBeUndefined();
  }
});

test('explicit positive worker limits keep priority in every environment', () => {
  for (const env of [{}, { CI: 'true' }, { WS_COMMIT_RELATED_TOKEN: 'invocation' }]) {
    for (const value of ['1', '2', '6']) {
      expect(vitestMaxWorkers({ ...env, WS_VITEST_MAX_WORKERS: value })).toBe(Number(value));
    }
  }
});

test('invalid explicit limits still refuse rather than falling back', () => {
  for (const value of ['', '0', '-1', '1.5', '2x', '9007199254740992']) {
    expect(() => vitestMaxWorkers({ WS_COMMIT_RELATED_TOKEN: 'invocation', WS_VITEST_MAX_WORKERS: value }))
      .toThrow('WS_VITEST_MAX_WORKERS must be a positive integer');
  }
});
