import * as v from 'valibot';

const number = v.pipe(v.number(),v.finite(),v.minValue(-1e6),v.maxValue(1e6));
const positive = v.pipe(number,v.minValue(.00001));
const count = v.pipe(positive,v.integer(),v.maxValue(4096));
const text = v.pipe(v.string(),v.minLength(1),v.maxLength(8_000_000));
/** Original compressed bytes, inline or in an admitted product file. */
export type GrassPayload = string | {file:string};
export const GrassPayloadSchema:v.GenericSchema<unknown,GrassPayload> = v.union([text,v.strictObject({file:v.pipe(v.string(),v.maxLength(240),
  v.regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u))})]);
const tuple = v.tuple([number,number,number]);
const grid = v.object({ T: positive, G: v.pipe(count,v.maxValue(32)) });
const tier = v.object({ rings: v.pipe(v.array(grid),v.minLength(1),v.maxLength(8)), flowers: grid,
  cards: v.object({ T: positive, s: positive }), near: v.tuple([number,number]), per: count,
  scenes: v.object({ blades: GrassPayloadSchema, flowers: GrassPayloadSchema, cards: GrassPayloadSchema }) });
/** Bounded camera-ring buffers, lattice and presentation tuning. */
export const GrassPresentationSchema = v.object({ height: GrassPayloadSchema, mask: GrassPayloadSchema, field: GrassPayloadSchema, ground: GrassPayloadSchema, phone: tier, desktop: tier,
  view: v.object({ looks: v.tuple([text,text,text]), half: positive, heightSize: count, heightOrigin: number, lattice: positive,
    gain: positive, playerRadius: positive, cardsHeight: positive, ringHeight: positive,
    /** the player's trail on the shared trample field: pushes faster than `speedLimit` (m/s, a teleport) are dropped */
    trail: v.object({ speedLimit: positive, strength: positive }),
    gainFalloff: tuple, saturationFalloff: tuple, tintNight: tuple, tintStorm: tuple }) });
export type GrassPresentationRows = v.InferOutput<typeof GrassPresentationSchema>;
/** All declared binary blocks, in row order with duplicate file loans read once. */
export function grassPresentationFiles(rows: GrassPresentationRows): readonly string[] {
  return [...new Set([rows.height,rows.mask,rows.field,rows.ground,
    ...Object.values(rows.phone.scenes),...Object.values(rows.desktop.scenes)]
    .flatMap(row=>typeof row==='string'?[]:[row.file]))];
}
/** A level's static capture: its layer, map sizes, bounds and quality rows (the pass programs are the host's). */
export const StaticCaptureSchema = v.strictObject({ layer: v.pipe(number,v.integer(),v.minValue(0),v.maxValue(31)),
  shadowSize: v.strictObject({ phone: count, desktop: count }), contactSize: count, half: positive,
  rekeyDegrees: positive, heightOrigin: number, heightSize: positive, depthBias: positive, contact: number,
  staticOffCsm: v.strictObject({ phone: v.boolean(), desktop: v.boolean() }) });
export type StaticCaptureRows = v.InferOutput<typeof StaticCaptureSchema>;
