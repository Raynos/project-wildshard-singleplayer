import * as v from 'valibot';

const finite = v.number();
const SURFACES = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand', 'water', 'grass', 'wetSand', 'planks', 'shell', 'ground', 'edge', 'earth'] as const;
const V3 = v.tuple([finite, finite, finite]);
const STYLES = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'] as const;
const Spec = v.strictObject({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.picklist(STYLES), ink: v.exactOptional(v.string()) });
export const Place = v.strictObject({
  at: V3, normal: V3, size: finite, spec: Spec, gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
  board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
});
const SignCall = v.variant('k', [
  v.strictObject({ k: v.literal('place'), p: Place }),
  v.strictObject({ k: v.literal('light'), c: V3, r: V3, u: V3, w: finite, h: finite, color: finite, gain: finite, mode: v.picklist([1, 2] as const), seed: finite }),
  v.strictObject({ k: v.literal('tube'), a: V3, b: V3, f: V3, width: finite, color: finite, gain: finite, flicker: finite }),
]);
const Geometry = v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8'] as const), finite, v.boolean()])),
  count: finite, index: v.nullable(v.picklist(['u16', 'u32'] as const)), indexCount: finite, box: v.boolean(),
});
const Slot = v.strictObject({ at: V3, normal: V3, size: finite, color: finite, blade: v.boolean() });
const Named = v.strictObject({ name: v.string(), geo: finite });
const KINDS = ['block', 'street', 'well', 'plaza', 'green', 'gate'] as const;
const Params = v.record(v.string(), v.union([finite, v.string(), v.boolean()]));
const Box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
  yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface: v.exactOptional(v.picklist(SURFACES)) });

/** the bake's rows (the binary's JSON head), strictly */
export const LayoutRowsSchema = v.strictObject({
  version: v.literal(1),
  geometries: v.array(Geometry),
  kits: v.array(v.strictObject({ name: v.string(), geo: v.nullable(finite), compact: v.boolean() })),
  alphaKits: v.array(Named),
  kitxs: v.array(Named),
  reflective: v.array(v.string()),
  farOf: v.array(v.tuple([v.string(), finite])),
  counts: v.strictObject({ walkers: finite, sitters: finite, lanterns: finite, acs: finite, hooks: finite, hookMounts: finite, steam: finite, pieces: finite, windows: finite, lions: finite }),
  inKit: v.array(v.strictObject({ model: v.string(), kit: v.string(), at: v.strictObject({ x: finite, y: finite, z: finite, yaw: v.exactOptional(finite), variant: v.exactOptional(v.string()), params: v.exactOptional(Params) }), box: v.nullable(v.tuple([finite, finite, finite, finite, finite, finite])) })),
  map: v.array(v.strictObject({ x0: finite, z0: finite, x1: finite, z1: finite, kind: v.picklist(KINDS) })),
  emitters: v.array(v.strictObject({ at: V3, color: V3, w: finite, h: finite, power: finite, spill: finite })),
  pieces: v.array(v.string()),
  slots: v.strictObject({ early: v.array(Slot), late: v.array(Slot) }),
  shell: v.nullable(finite),
  towers: finite,
  merged: v.array(v.tuple([v.string(), v.tuple([finite, finite, finite, finite, finite, finite])])),
  inst: v.array(v.tuple([v.string(), finite])),
  rng: v.strictObject({ version: finite, state: finite, initial: finite, scrambledFork: v.boolean() }),
  signs: v.array(SignCall),
  crossings: v.array(Box),
  sets: v.array(v.strictObject({ name: v.string(), geo: finite, count: finite })),
  sheets: v.array(v.strictObject({ y: finite, band: finite, a: finite })),
  banyan: v.nullable(v.strictObject({ lumps: v.array(v.strictObject({ c: V3, r: V3, up: finite, seed: finite, wash: finite })), hangs: v.array(V3) })),
});
export type LayoutRows = v.InferOutput<typeof LayoutRowsSchema>;
export type SignCallRow = v.InferOutput<typeof SignCall>;
export type BakedPlace = v.InferOutput<typeof Place>;



const text = v.string();
export const GeometryLibrarySchema = v.strictObject({ layout: v.array(text), boot: v.array(text), explorer: v.array(text),
  specimenBoxes: v.record(text, v.boolean()), records: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_000_000)),
  layoutDraws: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(122)) });
export const GeometryBootSchema = v.strictObject({ rows: LayoutRowsSchema, library: GeometryLibrarySchema,
  negativeZeros: v.array(v.array(text)) });
/** Named blob types only; this declaration adds no custom output section. */
export const SECTIONS = {};
