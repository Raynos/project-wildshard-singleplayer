import { expect, it } from 'vitest';
import { SKY_FLOCK_ROWS, SKY_SPAWNS } from '../../../src/shards/far-reach/data/spawns';
import { RAY_HOMES, ROOST_RAYS, WISP_HOMES, ROC, GOATS } from '../../../src/shards/far-reach/data/layout';
import { apothem } from '../../../src/shards/far-reach/layout';
import frozen from '../../fixtures/species-oracle/skySpawns.json' with { type: 'json' };

it('keeps the published finite spawn closure byte-identical to the shipping authored rows', () => {
  expect(JSON.stringify(SKY_SPAWNS)).toBe(JSON.stringify(frozen));
  expect(SKY_FLOCK_ROWS.map(row => row.id)).toEqual(['far.ray.0', 'far.roost.0', 'far.roost.1', 'far.roost.2',
    'far.wisp.0', 'far.wisp.1', 'far.wisp.2', 'far.roc', 'far.goat.0', 'far.goat.1', 'far.goat.2', 'far.goat.3', 'far.goat.4']);
  expect(SKY_FLOCK_ROWS).toHaveLength(13);
});

it('retains every actual body home including the native rim-aware goat floor and Roc home', () => {
  expect(SKY_FLOCK_ROWS.map(row => row.home)).toEqual([...RAY_HOMES, ...ROOST_RAYS, ...WISP_HOMES, ROC,
    ...GOATS.map(goat => ({ x: goat.isle.x, z: goat.isle.z, r: apothem(goat.isle), y: goat.isle.y }))]);
});
