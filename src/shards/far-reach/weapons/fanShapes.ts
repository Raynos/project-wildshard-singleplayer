import { BufferGeometry } from 'three';
import { GeometryPack, fetchDeflated, packedRows } from '@wildshard/sdk/kit/geometryPack';
import fanRows from '../data/fan.json' with { type: 'json' };
import { FAN_URL } from '../boot/files';

/**
 * The war fan's and the code hand's built shapes, baked offline (SHARD-PLATFORM M3: generators/fan.ts,
 * `scripts/bake-sky-world.mjs` → `baked/fan.bin` + `data/fan.json`): the leaf, the sticks, the guards, the gilt rim, the
 * bronze plates, the tassel's fringe, the glove's leather and its sleeve. weapons/fanModel.ts and weapons/glove.ts give
 * them their materials.
 */

let pack: InstanceType<typeof GeometryPack> | null = null;
const ROWS = packedRows(fanRows);
/** Load the fan's baked shapes (with the other baked pieces, before the world is built); a failed load leaves the fan without them. */
export async function loadSkyFan(): Promise<void> {
  try { pack = new GeometryPack(await fetchDeflated(FAN_URL), ROWS, 'far-reach fan'); } catch (e: unknown) { console.error('[far-reach] the baked war fan did not load:', e); }
}
/** The baked shapes by name. */
export type FanShape = 'panels' | 'sticks' | 'straps' | 'guards' | 'rim' | 'plates' | 'strands' | 'leather' | 'sleeve';
/** One of the baked shapes, a copy its caller owns; empty when the bake did not load. */
export const fanShape = (name: FanShape): BufferGeometry => pack?.geometry(fanRows[name]) ?? new BufferGeometry();
