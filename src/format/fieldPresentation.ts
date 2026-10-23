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
interface GrassGridRows {T:number;G:number}
type GrassTierSchema = v.ObjectSchema<{
  rings:v.GenericSchema<GrassGridRows[]>;flowers:v.GenericSchema<GrassGridRows>;
  cards:v.ObjectSchema<{T:v.GenericSchema<number>;s:v.GenericSchema<number>},undefined>;
  near:v.GenericSchema<[number,number]>;per:v.GenericSchema<number>;
  scenes:v.ObjectSchema<{blades:typeof GrassPayloadSchema;flowers:typeof GrassPayloadSchema;cards:typeof GrassPayloadSchema},undefined>;
},undefined>;
interface GrassViewRows {
  looks:[string,string,string];half:number;heightSize:number;heightOrigin:number;lattice:number;
  gain:number;playerRadius:number;cardsHeight:number;ringHeight:number;
  trail:{speedLimit:number;strength:number};
  gainFalloff:[number,number,number];saturationFalloff:[number,number,number];tintNight:[number,number,number];tintStorm:[number,number,number];
}
type GrassPresentationType = v.ObjectSchema<{
  height:typeof GrassPayloadSchema;mask:typeof GrassPayloadSchema;field:typeof GrassPayloadSchema;ground:typeof GrassPayloadSchema;
  phone:GrassTierSchema;desktop:GrassTierSchema;view:v.GenericSchema<GrassViewRows>;
},undefined>;
/** Bounded camera-ring buffers, lattice and presentation tuning. */
export const GrassPresentationSchema:GrassPresentationType = v.object({ height: GrassPayloadSchema, mask: GrassPayloadSchema, field: GrassPayloadSchema, ground: GrassPayloadSchema, phone: tier, desktop: tier,
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
/** Static capture sizes and tuning; the native passes retain their original programs. */
export interface StaticCaptureRows {
  layer:number;shadowSize:{phone:number;desktop:number};contactSize:number;half:number;
  rekeyDegrees:number;heightOrigin:number;heightSize:number;depthBias:number;contact:number;
  staticOffCsm:{phone:boolean;desktop:boolean};
}
/** A level's static capture: its layer, map sizes, bounds and quality rows (the pass programs are the host's). */
export const StaticCaptureSchema:v.GenericSchema<StaticCaptureRows> = v.strictObject({ layer: v.pipe(number,v.integer(),v.minValue(0),v.maxValue(31)),
  shadowSize: v.strictObject({ phone: count, desktop: count }), contactSize: count, half: positive,
  rekeyDegrees: positive, heightOrigin: number, heightSize: positive, depthBias: positive, contact: number,
  staticOffCsm: v.strictObject({ phone: v.boolean(), desktop: v.boolean() }) });
