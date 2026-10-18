import { Color } from 'three';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { bakedHuntGround, type HuntGround } from '@wildshard/engine/ai/huntPattern';
import type { BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { treeGridOf, type TreeInstance } from '@wildshard/engine/world/forest/placement';
import { TERRAIN } from '../world/terrain';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The creature manager's stream: `Rng(SEED + 31)` with the level's seed (shard.config.ts `seed: 1337`). */
export const PINE_HERD_STREAM = 1337 + 31;

/** The forest's trunk circles as the page's hunting brain read them (data/physics.generated.json `trees`: x, z, r, generators/physics.ts). */
export function pineTrees(): readonly TreeInstance[] {
  return baked.trees
    .map(([x, z, r]) => ({ x, y: 0, z, r, variant: 0, scale: 1, rot: 0, height: 0, tint: new Color() }));
}

/**
 * Pine Hollow's ground as the herds' placement and hunting brain read it in the browser (SF72), renderer-free: the baked
 * terrain grid's height and normal (public/assets/baked/pine-hollow/terrain.bin, the samplers the page installs before
 * the herds), the analytic field's trails, pads, creek and pond (world/terrain.ts), and the baked forest's trunks. Pine has
 * no sea and no water of its own beyond the water line, the creek and the pond.
 */
export function pineHuntGround(grid: BakedGrid, trees: readonly TreeInstance[] = pineTrees()): HuntGround {
  const forest = treeGridOf(trees);
  return bakedHuntGround(grid, { field: TERRAIN, chunkHalf: CHUNK_HALF, trees: (x, z, r) => forest.nearby(x, z, r),
    treeless: () => trees.length === 0, sea: () => false, wetAt: () => false });
}

/** The King's species as the creature manager's spawn reads it: kind 'antler-king', his one variant (runtime/antlerKing.ts). */
export const PINE_KING_KIND = 'antler-king';
