// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bindLevelSelection } from '@wildshard/engine/level/selection';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { HeightfieldBinding, bindHeightfield } from '@wildshard/engine/world/Heightfield';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';
import { MANIFEST } from '../src/shards/driftwood-isle/discovery.generated';
import { GROUND_LOOK } from '../src/shards/driftwood-isle/generators/groundLook';
import { OCEAN } from '../src/shards/driftwood-isle/world/sites';
import { facetedGroundGlbs } from '../src/shards/driftwood-isle/generators/facetedGround';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { islandClipFacts } from '../src/shards/driftwood-isle/generators/islandClips';
import { GROUND_FILES } from '../src/shards/driftwood-isle/generators/groundFiles';

it('bakes the faceted ground on the heights the runtime walks, in the provoking-vertex order', async () => {
  const terrain = MANIFEST.ground.terrain;
  if (terrain === undefined) throw new Error('Native island ground is required');
  const level: LevelSpec = { id: MANIFEST.slug, ground: { terrain }, spawn: MANIFEST.spawn, sky: MANIFEST.sky, atmosphere: MANIFEST.atmosphere, grade: MANIFEST.grade,
    budgets: {}, mechanisms: [], fight: {}, boot: { files: [] }, audio: { ambience: 'none', score: 'none' }, loadout: { weapons: [], tools: [], start: [] }, species: [], spawns: [], minimap: {}, kitLook: 'toon' };
  const restoreLevel = bindLevelSelection(level), binding = new HeightfieldBinding(level);
  binding.install(readNativeTerrain(driftwoodGroundBytes()));
  const restoreGround = bindHeightfield(binding);
  try {
    const glbs = facetedGroundGlbs(binding.field, GROUND_LOOK, OCEAN.level);
    const grid = modelGeometry(GROUND_FILES.ground), walls = modelGeometry(GROUND_FILES.slab);
    await grid.load(glbs.ground); await walls.load(glbs.slab);
    const ground = grid.take(), slab = walls.take();
    const pos = ground.getAttribute('position'), index = ground.getIndex();
    expect(pos.count).toBe(256 * 256);
    expect(index?.count).toBe(islandClipFacts().outputIndices); // the baked island's cells dropped (its tiles stand there)
    expect(index?.array).toBeInstanceOf(Uint16Array);
    // the first two cells keep their alternating diagonals, the provoking (last) vertex where the paint expects it
    expect(Array.from(index?.array.slice(0, 12) ?? [])).toEqual([0, 256, 1, 1, 256, 257, 1, 257, 258, 1, 258, 2]);
    expect(ground.getAttribute('color').count).toBe(pos.count);
    expect(slab.getAttribute('position').count).toBe(slab.getAttribute('color').count);
    // the drawn ground is the ground the player stands on: every baked vertex at the live height law of its grid point
    const step = CHUNK_SIZE / 255;
    let worst = 0;
    for (let i = 0; i < pos.count; i++) worst = Math.max(worst, Math.abs(pos.getY(i) - Math.fround(terrainHeight(-CHUNK_HALF + (i % 256) * step, -CHUNK_HALF + Math.floor(i / 256) * step))));
    expect(worst).toBe(0);
    ground.dispose(); slab.dispose();
  } finally { restoreGround(); restoreLevel(); }
});
