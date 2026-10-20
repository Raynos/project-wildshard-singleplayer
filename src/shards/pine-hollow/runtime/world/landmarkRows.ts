import * as v from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

const n = v.pipe(v.number(), v.finite()), xyz = v.tuple([n, n, n]);
const pose = v.object({ x: n, y: n, z: n, yaw: n, scale: n, pitch: n, roll: n });
const rows = v.object({ canoe: v.array(pose), lamps: v.pipe(v.array(xyz), v.maxLength(3)) });
let admitted: v.InferOutput<typeof rows> | undefined;
/** Named facts are admitted before native landmark or chapter views bind. */
export async function admitLandmarkRows(product: ShardProduct): Promise<void> { admitted = v.parse(rows, await product.json('world/landmark-view.json')); }
export function landmarkRows(): v.InferOutput<typeof rows> { if (admitted === undefined) throw new Error('Landmark rows are not admitted'); return admitted; }
