// oxlint-disable-next-line import/no-nodejs-modules -- Pin the exact predecessor's metadata and double-precision coordinates.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import pine from '../src/shards/pine-hollow/data/layout.generated.json' with { type: 'json' };
import { inBeaverPool, FOREST_QUERIES } from '../src/shards/pine-hollow/world/terrain';
import { creekWaterAt, inBeaverPool as originalPool } from '../src/shards/pine-hollow/generators/geography';
import groundRows from '../src/shards/pine-hollow/data/ground.generated.json' with { type: 'json' };
import { declaredGround } from '../src/game/shard/manifest';
import { setLiveWaterLevel } from '../src/engine/world/water/declared';
import { forestDensity, oldGrowthMask, speciesMix } from '../src/shards/pine-hollow/generators/forestGeography';
import geography from '../src/shards/pine-hollow/data/geography.generated.json' with { type: 'json' };
import manifest from '../src/shards/pine-hollow/manifest.json' with { type: 'json' };
import { PINE_TREE_IDS } from '../src/shards/pine-hollow/generators/treeSet';

const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

it('retains every Pine coordinate and discovery anchor from ac722f90c', () => {
  const fixed = Object.fromEntries(Object.entries(pine).filter(([name]) => name !== 'beaverPoolLevel'));
  expect(digest(fixed)).toBe('cd5c2991da80c6159aa96f2a0d5a324c9ff6fd8b82630aa3db0b6cf6c47b3277');
  expect(pine.SPURS['den']).toBe(pine.DEN_TRAIL);
  expect(pine.SPURS['lookout']).toBe(pine.LOOKOUT_TRAIL);
  expect(pine.GRADED.paths[0]).toBe(pine.LOOKOUT_TRAIL);
});

const creek = declaredGround(groundRows).water?.find(body => body.id === 'creek');
const POOL = 'pine-hollow.beaver-pool';

it('keeps the declared creek under the live beaver pool level', () => {
  if (creek === undefined) throw new Error('Missing declared creek');
  const [x, z] = [-137.5, 65].map(Number);
  if (x === undefined || z === undefined) throw new Error('Missing pool sample');
  try {
    setLiveWaterLevel(POOL, pine.BEAVER_POOL.full);
    expect(creek.restAt(x, z)).toBeCloseTo(pine.BEAVER_POOL.full, 6);
    setLiveWaterLevel(POOL, pine.BEAVER_POOL.drained);
    expect(creek.restAt(x, z)).toBeLessThan(pine.BEAVER_POOL.full);
  } finally { setLiveWaterLevel(POOL, pine.BEAVER_POOL.full); }
});

it('retains every exact forest candidate answer across clearings and species zones', () => {
  expect(manifest.forest.speciesTraits.map(trait => trait.id)).toEqual(PINE_TREE_IDS);
  expect(geography.forest).toHaveLength(3364);
  for (const row of geography.forest) {
    expect(FOREST_QUERIES.density(row.x, row.z)).toBe(forestDensity(row.x, row.z));
    expect(FOREST_QUERIES.scale(row.x, row.z)).toBe(1 + oldGrowthMask(row.x, row.z) * 0.25);
    expect(FOREST_QUERIES.species(row.x, row.z)).toEqual(speciesMix(row.x, row.z, manifest.forest.speciesTraits.map(trait => trait.id)));
  }
});

it('retains the creek profile and pool clip at full, partial and drained levels', () => {
  const initial = pine.beaverPoolLevel.y;
  try {
    if (creek === undefined) throw new Error('Missing declared creek');
    // G4: the declared creek keeps the creek law within 8 cm (similar, not identical: G415), its banks inside the cell
    for (const level of [pine.BEAVER_POOL.full, (pine.BEAVER_POOL.full + pine.BEAVER_POOL.drained) / 2, pine.BEAVER_POOL.drained]) {
      pine.beaverPoolLevel.y = level; setLiveWaterLevel(POOL, level);
      for (let x = -238.3; x <= 238; x += 2.5) for (let z = -238.3; z <= 238; z += 2.5) {
        const expected = creekWaterAt(x, z), actual = creek.restAt(x, z);
        expect(actual === null).toBe(expected === null);
        if (expected !== null && actual !== null) expect(Math.abs(actual - expected)).toBeLessThan(0.08);
      }
    }
    let clipped = 0;
    for (let x = -240; x < -90; x += 1.25) for (let z = -245; z < 120; z += 1.25) {
      const actual = inBeaverPool(x, z);
      expect(actual).toBe(originalPool(x, z));
      if (actual) clipped++;
    }
    expect(clipped).toBeGreaterThan(0);
  } finally { pine.beaverPoolLevel.y = initial; setLiveWaterLevel(POOL, initial); }
});
