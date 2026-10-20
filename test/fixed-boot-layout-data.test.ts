// oxlint-disable-next-line import/no-nodejs-modules -- Pin the exact predecessor's metadata and double-precision coordinates.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import pine from '../src/shards/pine-hollow/data/layout.generated.json' with { type: 'json' };
import { creekSurfaceAt, inBeaverPool, FOREST_QUERIES } from '../src/shards/pine-hollow/world/terrain';
import { creekSurfaceAt as originalSurface, inBeaverPool as originalPool } from '../src/shards/pine-hollow/generators/geography';
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

it('keeps the beaver pool level live after fixed layout data leaves runtime', () => {
  const initial = pine.beaverPoolLevel.y;
  try {
    pine.beaverPoolLevel.y = pine.BEAVER_POOL.full;
    expect(creekSurfaceAt(pine.BEAVER_POOL.centre)).toBe(pine.BEAVER_POOL.full);
    pine.beaverPoolLevel.y = pine.BEAVER_POOL.drained;
    expect(creekSurfaceAt(pine.BEAVER_POOL.centre)).toBeLessThan(pine.BEAVER_POOL.full);
    expect(pine.BEAVER_POOL.full).toBe(initial);
  } finally { pine.beaverPoolLevel.y = initial; }
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
    for (const level of [pine.BEAVER_POOL.full, (pine.BEAVER_POOL.full + pine.BEAVER_POOL.drained) / 2, pine.BEAVER_POOL.drained]) {
      pine.beaverPoolLevel.y = level;
      for (let s = -1; s < 550; s += 0.125) expect(creekSurfaceAt(s)).toBe(originalSurface(s));
    }
    let clipped = 0;
    for (let x = -240; x < -90; x += 1.25) for (let z = -245; z < 120; z += 1.25) {
      const actual = inBeaverPool(x, z);
      expect(actual).toBe(originalPool(x, z));
      if (actual) clipped++;
    }
    expect(clipped).toBeGreaterThan(0);
  } finally { pine.beaverPoolLevel.y = initial; }
});
