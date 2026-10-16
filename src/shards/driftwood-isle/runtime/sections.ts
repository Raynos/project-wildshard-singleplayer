import * as v from 'valibot';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const run = v.strictObject({ start: natural, count: natural });
const runs = v.pipe(v.array(run), v.maxLength(512));
const site = v.strictObject({ x: number, z: number, rot: number });
const point = v.strictObject({ x: number, y: number, z: number });
const anchor = v.strictObject({ x: number, y: number, z: number, yaw: number });
const box = v.strictObject({ x: number, z: number, hw: number, hd: number, rot: number, yBottom: number, yTop: number });
const desc = v.variant('kind', [
  v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number }),
  v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: number, count: natural }),
]);
const boxes = v.pipe(v.array(box), v.maxLength(128));
const descs = v.pipe(v.array(desc), v.maxLength(128));

/** Product-owned logical names and the client's build-time rows (W2b, G449); runtime/ never imports data/. */
export const SECTIONS = {
  'custom/assets': v.strictObject({
    byUrl: v.record(v.pipe(v.string(), v.maxLength(512)), v.pipe(v.string(), v.maxLength(240))),
  }),
  /** the faceted sky's cumulus ring: rows `[x, y, z, r, puff, cluster, baseY]` (generators/cumulus.ts) */
  'custom/cumulusPuffs': v.pipe(v.array(v.pipe(v.array(number), v.length(7))), v.maxLength(1024)),
  /** the native terrain's retained index runs around the baked island (generators/islandClips.ts) */
  'custom/islandClips': v.strictObject({ sourceVertices: natural, sourceIndices: natural, outputIndices: natural, ranges: runs }),
  /** the fixed models' baked layouts: the chime's draw slots, the hut's and the lookout's colliders, anchors and floors */
  'custom/fixedLayouts': v.strictObject({
    chimeSlots: runs,
    hut: v.strictObject({ site, origin: point, floorY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
      floor: v.strictObject({ cos: number, sin: number, lift: number, deck: v.strictObject({ w: number, d: number, z: number }), steps: v.strictObject({ z0: number, len: number, w: number }) }) }),
    lookout: v.strictObject({ site, zipTo: v.strictObject({ x: number, z: number }), origin: point, platformY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
      floor: v.strictObject({ cos: number, sin: number, plat: number, h: number, stair: v.strictObject({ x0: number, len: number, w: number }) }) }),
  }),
} as const;
