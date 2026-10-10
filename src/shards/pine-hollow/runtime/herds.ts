import * as v from 'valibot';
import { Color } from 'three';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { HuntGround, HuntSpecies } from '@wildshard/engine/ai/hunt';
import type { VariantDef, VariantTable } from '@wildshard/engine/entities/species/registry';
import { DEER } from '@wildshard/game/systems/species/deer';
import { ELK } from '@wildshard/game/systems/species/elk';
import { PINE_BEAR, PINE_BOAR, PINE_ELK_THRALL } from '../species/rows';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { treeGridOf, type TreeInstance } from '@wildshard/engine/world/forest/placement';
import { TERRAIN } from '../world/terrain';
import baked from './physics.baked.json' with { type: 'json' };

/** The creature manager's stream: `Rng(SEED + 31)` with the level's seed (shard.config.ts `seed: 1337`). */
export const PINE_HERD_STREAM = 1337 + 31;

const finite = v.pipe(v.number(), v.finite());
/** The forest's trunk circles as the page's hunting brain read them (src/shards/pine-hollow/generators/bake-pine-physics.mjs `trees`: x, z, r). */
export function pineTrees(): readonly TreeInstance[] {
  return v.parse(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), baked.trees)
    .map(([x, z, r]) => ({ x, y: 0, z, r, variant: 0, scale: 1, rot: 0, height: 0, tint: new Color() }));
}

/**
 * Pine Hollow's ground as the herds' placement and hunting brain read it in the browser (SF72), renderer-free: the baked
 * terrain grid's height and normal (public/assets/baked/pine-hollow/terrain.bin, the samplers the page installs before
 * the herds), the analytic field's trails, pads, creek and pond (world/terrain.ts), and the baked forest's trunks. Pine has
 * no sea and no water of its own beyond the water line, the creek and the pond.
 */
export function pineHuntGround(grid: BakedGrid, trees: readonly TreeInstance[] = pineTrees()): HuntGround {
  const samplers = bakedSamplers(grid), forest = treeGridOf(trees), stream = TERRAIN.streamAt;
  return {
    heightAt: samplers.heightAt, normalY: (x, z) => samplers.normalAt(x, z)[1], trailDistance: TERRAIN.trailDistance, cabinMask: TERRAIN.cabinMask,
    inChunk: (x, z, margin) => Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin,
    streamAt: (x, z) => stream === undefined ? null : stream(x, z), waterLevel: () => TERRAIN.waterLevel(), pond: () => TERRAIN.pond,
    sea: () => false, wetAt: () => false, trees: (x, z, r) => forest.nearby(x, z, r), treeless: () => trees.length === 0, terrain: () => true, chunkHalf: CHUNK_HALF,
  };
}

/** The King's species as the creature manager's spawn reads it: kind 'antler-king', his one variant (runtime/antlerKing.ts). */
export const PINE_KING_KIND = 'antler-king';

/**
 * Pine's creature rows as the manager's spawn rolls and hunting brain read them, renderer-free (SF72; `spawnRolls`'
 * species seam and `HuntConfig.species`): the kit's deer, the kit's elk with Pine's thrall (species/rows.ts pineElk), Pine's
 * boar and bear, and the Antler King's one variant (`king`: his scale is the baked body's, models/antlerKing.ts KING_VARIANT).
 * The kit's deer and elk rows are public game modules for this (`@wildshard/game/systems/species/deer` / `elk`, beside
 * bear and boar): a renderer-free host reads the rows the page registers, never the global registry.
 */
export function pineSpawnSpecies(king: VariantDef): (kind: string) => VariantTable & HuntSpecies {
  const elk = { ...ELK, spawnOnly: [PINE_ELK_THRALL] };
  const rows = new Map<string, VariantTable & HuntSpecies>([['deer', DEER], ['elk', elk], ['boar', PINE_BOAR], ['bear', PINE_BEAR],
    [PINE_KING_KIND, { ...ELK, kind: PINE_KING_KIND, variants: [king], aggressive: true }]]);
  return (kind) => { const row = rows.get(kind); if (row === undefined) throw new Error(`Pine has no creature row '${kind}'`); return row; };
}
