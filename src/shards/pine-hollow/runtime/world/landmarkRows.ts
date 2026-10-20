import * as v from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

const n = v.pipe(v.number(), v.finite()), xyz = v.tuple([n, n, n]), site = v.object({ x: n, z: n, yaw: n });
const pose = v.object({ x: n, y: n, z: n, yaw: n, scale: n, pitch: n, roll: n });
const rows = v.object({ contractBoardSite: site, waystoneSites: v.object({ pond: site, ridge: site, den: site }),
  zip: v.object({ top: xyz, bottom: xyz, launch: xyz, landing: xyz }),
  timberFloors: v.record(v.string(), v.array(v.object({ x: n, y: n, z: n, hw: n, hd: n, rot: n }))),
  stones: v.pipe(v.array(v.object({ kind: v.string() })), v.maxLength(16)), canoe: v.array(pose), lamps: v.pipe(v.array(xyz), v.maxLength(3)),
});
let admitted: v.InferOutput<typeof rows> | undefined;
/** Named facts are admitted before native landmark or chapter views bind. */
export async function admitLandmarkRows(product: ShardProduct): Promise<void> { admitted = v.parse(rows, await product.json('world/landmark-view.json')); }
export function landmarkRows(): v.InferOutput<typeof rows> { if (admitted === undefined) throw new Error('Landmark rows are not admitted'); return admitted; }

export function contractBoardSite(): { x: number; z: number; yaw: number } { return { ...landmarkRows().contractBoardSite }; }
export function waystoneSites(): v.InferOutput<typeof rows>['waystoneSites'] { return structuredClone(landmarkRows().waystoneSites); }
export function landmarkFloors(id: string): readonly { x: number; y: number; z: number; hw: number; hd: number; rot: number }[] { const floors = landmarkRows().timberFloors[id]; if (floors === undefined) throw new Error('Missing landmark floors'); return floors; }
