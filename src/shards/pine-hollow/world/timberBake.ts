/**
 * Pine Hollow's timber landmarks from their offline bakes (G285, SF72 "bake the code-built worlds"). A timber's builder runs
 * at build time (`../generators/timberBake.ts` records what it leaves: each material's parts and the glass as float32
 * attribute blocks in a binary, the colliders, deck floors and anchors as a row); here a row and its blocks become the
 * timber again, ready to `finish` (./timber.ts `Timber.baked`), exactly as the builder's own timber was.
 */
import * as v from 'valibot';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MatKey } from './homestead';

const num = v.pipe(v.number(), v.finite());
const xyz = v.strictObject({ x: num, y: num, z: num });
const Surface = v.optional(v.picklist(['wood', 'stone']));
const Box = v.strictObject({ kind: v.literal('box'), x: num, y: num, z: num, hx: num, hy: num, hz: num, yaw: v.optional(num), rot: v.optional(v.strictObject({ x: num, y: num, z: num, w: num })), surface: Surface });
const Treads = v.strictObject({ kind: v.literal('treads'), from: xyz, to: xyz, width: num, count: num, surface: Surface });
const Floor = v.strictObject({ x: num, z: num, rot: num, hw: num, hd: num, y: num });
/** the timber kit's materials (homestead.ts `MatKey`) */
const MAT_KEYS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly MatKey[];
const Part = v.strictObject({ key: v.picklist(MAT_KEYS), counts: v.array(num) });
/** a baked timber's row: its parts' vertex counts per material (in the builder's order), the glass's, its facts */
export const TIMBER_ROW = { parts: v.array(Part), glass: v.array(num), colliders: v.array(v.variant('kind', [Box, Treads])), floors: v.array(Floor), anchors: v.record(v.string(), v.tuple([num, num, num])) };
export const TimberRowSchema = v.strictObject(TIMBER_ROW);
export type TimberRow = v.InferOutput<typeof TimberRowSchema>;
export type ColliderRow = TimberRow['colliders'][number];

/** a collider row as the timber kit made it */
export function colliderOf(c: ColliderRow): ColliderDesc {
  const surface = c.surface === undefined ? {} : { surface: c.surface };
  if (c.kind === 'treads') return { kind: 'treads', from: c.from, to: c.to, width: c.width, count: c.count, ...surface };
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.rot === undefined ? {} : { rot: c.rot }), ...surface };
}
