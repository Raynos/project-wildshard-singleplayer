import { expect, test } from 'vitest';
import { parseWorldScenes, worldScenesForTier } from '@wildshard/format/worldScenes';

function fixture() {
  return parseWorldScenes({ version: 1, catalogue: 'models/catalogue.json', materials: [],
    libraries: [{ id: 'shapes', kind: 'owned', models: [
      { id: 'shared', file: 'shared.glb' }, { id: 'small', file: 'small.glb', tier: 'phone' },
      { id: 'large', file: 'large.glb', tier: 'desktop' },
    ] }],
    batches: ['phone', 'desktop'].map(tier => ({ id: `draw.${tier}`, tier, material: 'stone',
      capacity: { vertices: 3, indices: 3, instances: 1 } })),
    placements: [{ id: 'common', file: 'common.json' },
      { id: 'small', file: 'small.json', tier: 'phone' }, { id: 'large', file: 'large.json', tier: 'desktop' }],
    steps: [{ id: 'profile', variants: { standalone: 'old.json', cell: 'new.json' } }],
  });
}

test.each(['phone', 'desktop'] as const)('selects %s before intake and keeps shared/profile rows', tier => {
  const source = fixture(), selected = worldScenesForTier(source, tier), library = selected.libraries[0];
  if (library?.kind !== 'owned') throw new Error('Missing owned library');
  expect(library.models.map(row => row.id)).toEqual(['shared', tier === 'phone' ? 'small' : 'large']);
  expect(selected.batches?.map(row => row.id)).toEqual([`draw.${tier}`]);
  expect(selected.placements?.map(row => row.id)).toEqual(['common', tier === 'phone' ? 'small' : 'large']);
  expect(selected.steps).toBe(source.steps);
  expect(source.batches).toHaveLength(2);
  expect(source.libraries[0]?.kind === 'owned' && source.libraries[0].models).toHaveLength(3);
});

test('rejects unknown tiers instead of silently skipping declarations', () => {
  const row = fixture();
  expect(() => parseWorldScenes({ ...row, batches: [{ ...row.batches[0], tier: 'tablet' }] })).toThrow();
});
