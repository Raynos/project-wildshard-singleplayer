// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { readFileSync } from 'node:fs';
import { HeightfieldBinding } from '../../src/engine/world/Heightfield.ts';
import { bakedSamplers, parseBakedTerrain } from '../../src/engine/world/BakedTerrain.ts';
import { toLevelSpec } from '../../src/game/shard/spec.ts';
import { DRIFTWOOD_ISLE } from '../../src/shards/driftwood-isle/manifest.ts';
import { trailsideGeometry } from '../../src/shards/driftwood-isle/generators/trailside.ts';
import { islandTrailsideSpec } from '../../src/shards/driftwood-isle/world/trailsideLayout.ts';

/** Bake the original trail against the same retained WSTR height binding as the native level. */
export function originalTrailside() {
  const bytes = Uint8Array.from(readFileSync(new URL('../../public/assets/baked/driftwood-isle/terrain.bin', import.meta.url)));
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null || grid.seed !== DRIFTWOOD_ISLE.seed) throw new Error('Original Driftwood native terrain missing');
  const binding = new HeightfieldBinding(toLevelSpec(DRIFTWOOD_ISLE));
  binding.install(bakedSamplers(grid));
  return trailsideGeometry(islandTrailsideSpec(), binding.field.heightAt);
}
