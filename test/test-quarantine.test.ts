import { expect, test } from 'vitest';
import { activeQuarantines, quarantineCohort } from '../scripts/test-quarantine';

test('quarantine preserves the whole suite and returns expired cases to blocking CI', () => {
  const row = { file: 'test/owner.test.ts', owner: 'lane', openedAt: '2026-10-27T07:00:00Z', expiresAt: '2026-10-28T07:00:00Z', reason: 'retained flake' };
  const registry = { version: 1, entries: [row] }, paths = [row.file, 'test/stable.test.ts'];
  const active = activeQuarantines(registry, Date.parse(row.openedAt));
  expect(quarantineCohort(paths, active, undefined)).toEqual(paths);
  expect(quarantineCohort(paths, active, 'products')).toEqual(['test/stable.test.ts']);
  expect(quarantineCohort(paths, active, 'product-free')).toEqual(['test/stable.test.ts']);
  expect(quarantineCohort(paths, active, 'quarantine')).toEqual([row.file]);
  const expired = activeQuarantines(registry, Date.parse(row.expiresAt));
  expect(quarantineCohort(paths, expired, 'products')).toEqual(paths);
  expect(quarantineCohort(paths, expired, 'quarantine')).toEqual([]);
  expect(() => activeQuarantines({ ...registry, entries: [row, row] })).toThrow();
  expect(() => activeQuarantines({ ...registry, entries: [{ ...row, owner: '' }] })).toThrow();
  expect(() => activeQuarantines({ ...registry, entries: [{ ...row, expiresAt: '2026-10-29T07:00:00Z' }] })).toThrow();
  expect(() => activeQuarantines(registry, Number.NaN)).toThrow('Invalid quarantine clock');
});
