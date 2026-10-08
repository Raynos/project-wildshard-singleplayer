import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';
import { SEED, TREE_COUNT, CHUNK_COORDS, _applyChunkConstants } from '../src/engine/core/config';
import { LevelFrameBinding } from '../src/engine/level/frame';
import { configureLevel } from '../src/engine/level/selection';
import { WaterBodies } from '../src/engine/world/water/body';
import { placeForest, plantSpecs } from '../src/engine/world/forest/placement';
import { toLevelSpec } from '../src/game/shard/spec';
import { DRIFTWOOD_ISLE } from '../src/shards/driftwood-isle/manifest';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';

it('plants the regional forest with its authored constants and restores the treeless home after leave', () => {
  const app = new App(), scope = app.engineScope.child('page'), entry = scope.child('entered');
  const home = toLevelSpec(DRIFTWOOD_ISLE), pine = toLevelSpec(PINE_HOLLOW);
  configureLevel(home);
  _applyChunkConstants({ slug: home.id, label: home.label ?? '', seed: home.seed ?? 0, treeCount: home.treeCount ?? 0 });
  const before = { seed: SEED, count: TREE_COUNT, label: CHUNK_COORDS };
  expect(before.count).toBe(0);
  const binding = new LevelFrameBinding({ level: pine, scope, water: new WaterBodies(), navmesh: null });
  try {
    binding.enter(app, entry);
    expect({ seed: SEED, count: TREE_COUNT, label: CHUNK_COORDS }).toEqual({ seed: PINE_HOLLOW.seed, count: 2600, label: PINE_HOLLOW.label });
    if (pine.trees === undefined) throw new Error('Missing authored tree set');
    const result = placeForest(plantSpecs(pine.trees));
    expect(result.trees.length).toBeGreaterThan(0); expect(result.trees.length).toBeLessThanOrEqual(2600);
    entry.dispose(); expect({ seed: SEED, count: TREE_COUNT, label: CHUNK_COORDS }).toEqual(before);
  } finally { scope.dispose(); }
});
