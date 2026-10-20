import * as v from 'valibot';
import { PackedGeometryRowsSchema } from './geometryPack';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const pair = v.tuple([n, n]), triple = v.tuple([n, n, n]);
const rows = <T extends v.GenericSchema>(schema: T) => v.pipe(v.array(schema), v.maxLength(256));
/** A baked cave interior's facts in its own frame (lx across, lz in, y world height) and its shell's collider rows. */
export const CaveFileSchema = v.strictObject({ meta: v.strictObject({ version: v.literal(1),
  holes: rows(v.strictObject({ lx: n, lz: n, hw: n, hd: n, y0: n, y1: n })),
  cuts: rows(v.strictObject({ lx: n, lz: n, hw: n, hd: n, below: n })),
  spots: rows(v.strictObject({ lx: n, lz: n, r: n })), inside: rows(pair),
  shaft: v.strictObject({ top: triple, foot: triple, r0: n, r1: n }),
  drips: rows(v.tuple([n, n, n, n])), floor: rows(pair),
  tris: v.strictObject({ cave: n, far: n, col: n }),
}), shell: v.unknown() });
/** A validated cave file. */
export type CaveFile = v.InferOutput<typeof CaveFileSchema>;

/**
 * A cave cut into the terrain as rows (G483 world scene assembly; client-only): its baked `file` in the product, its
 * mouth's frame, its look near the mouth (the shaft's lent graph and sizes, the drips, where the sun's disc hides under
 * the roof, the walls' day fill), the rock look it lends its two texture sets to and the roof patch: one geometry `part`
 * of a deflated geometry pack (`url`, its `rows`).
 */
export const CaveInteriorSchema = v.strictObject({
  product: id, file: id, frame: v.strictObject({ x: n, z: n, yaw: n }),
  roof: v.strictObject({ url: id, rows: PackedGeometryRowsSchema, part: v.pipe(n, v.integer(), v.minValue(0)) }),
  rock: v.strictObject({ look: id, fill: id, pbr: id, grit: id }),
  look: v.strictObject({
    near: n, under: v.strictObject({ height: n, lzMin: n, lzMax: n }), fill: pair, surface: v.literal('rock'),
    shaft: v.strictObject({ look: id, radialSegments: v.pipe(n, v.integer(), v.minValue(3), v.maxValue(64)), heightSegments: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(32)),
      renderOrder: n, gain: n, sunBase: n, sunGain: n, floor: n }),
    drips: v.strictObject({ color: n, size: n, opacity: n, period: n, periodStep: n, kinds: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(16)), phaseStep: n, gravity: n, hang: n, minDrop: n }),
  }),
});
/** Validated cave rows. */
export type CaveInteriorRows = v.InferOutput<typeof CaveInteriorSchema>;
