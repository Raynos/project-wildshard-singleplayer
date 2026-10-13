import { expect, it } from 'vitest';
import { canOverlayGuardTable } from '../scripts/precommit-guards.mjs';

const file = 'src/engine/example.ts';
const key = 'wildshard/no-raw-input';
const baseline = { allow: { fixed: 'unchanged' }, [key]: { [file]: 2 } };
const doc = (value: object): string => JSON.stringify(value);

it('retains source analysis only for reduced measured counts with identical policy', () => {
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ ...baseline, [key]: { [file]: 1 } }))).toBe(true);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ allow: baseline.allow }))).toBe(true);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ ...baseline, [key]: { [file]: 3 } }))).toBe(false);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ ...baseline, allow: { fixed: 'new permission' } }))).toBe(false);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ ...baseline, budget: 2 }))).toBe(false);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), doc({ ...baseline, [key]: { [file]: '1' } }))).toBe(false);
  expect(canOverlayGuardTable('lint/ratchet.json', doc(baseline), '{')).toBe(false);
});

it('cannot overlay native outputs, source or configuration under a generated table name', () => {
  for (const path of ['src/shards/pine-hollow/runtime/physics.baked.json', 'src/engine/example.ts', '.oxlintrc.json', 'lint/shard-coupling.json']) {
    expect(canOverlayGuardTable(path, '{}', '{}')).toBe(false);
  }
  expect(canOverlayGuardTable('scripts/README.md', 'old', 'new')).toBe(true);
  expect(canOverlayGuardTable('lint/shard-words.generated.json', '{}', '{"new":true}')).toBe(true);
});
