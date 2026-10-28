import { authorFormatSchema } from '@wildshard/sdk/formatJsonSchema';
import * as v from 'valibot';
import type { NineNativeAtlas, NineNativeSignInputs } from './nativeSignMetadata';
import type { GrappleRows } from '../data/grappleTypes';

const ReturnProgramSchema: ReturnType<typeof authorFormatSchema<'namedJsonContracts.ReturnProgramSchema'>> = authorFormatSchema('namedJsonContracts.ReturnProgramSchema');
const PracticeSceneSchema: ReturnType<typeof authorFormatSchema<'practiceCourseRows.PracticeSceneSchema'>> = authorFormatSchema('practiceCourseRows.PracticeSceneSchema');
const PracticeControllerSchema: ReturnType<typeof authorFormatSchema<'practiceCourseRows.PracticeControllerSchema'>> = authorFormatSchema('practiceCourseRows.PracticeControllerSchema');

const BurstFieldSchema: v.StrictObjectSchema<{ readonly name: v.StringSchema<undefined>; readonly shape: v.PicklistSchema<["flake", "streak"], undefined>; readonly count: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 1, undefined>, v.MaxValueAction<number, 24, undefined>]>; readonly life: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.MinValueAction<number, 0.001, undefined>, v.MaxValueAction<number, 1, undefined>]>; }, undefined> = v.strictObject({ name: v.string(), shape: v.picklist(['flake', 'streak']), count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(24)), life: v.pipe(v.number(), v.minValue(0.001), v.maxValue(1)) });
const BurstFieldsSchema: v.StrictObjectSchema<{ readonly muzzle: typeof BurstFieldSchema; readonly bite: typeof BurstFieldSchema; readonly dock: typeof BurstFieldSchema; readonly sparks: typeof BurstFieldSchema; }, undefined> = v.strictObject({ muzzle: BurstFieldSchema, bite: BurstFieldSchema, dock: BurstFieldSchema, sparks: BurstFieldSchema });

/** Original complete admission of the four named held-tool burst fields. */
export function parseBurstFields(value: unknown): GrappleRows['bursts'] { return v.parse(BurstFieldsSchema, value); }

const finiteUniform: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.FiniteAction<number, undefined>]> = v.pipe(v.number(), v.finite());
const UniformPair: v.StrictObjectSchema<{ readonly v2: v.TupleSchema<[typeof finiteUniform, typeof finiteUniform], undefined>; }, undefined> = v.strictObject({ v2: v.tuple([finiteUniform, finiteUniform]) });
const UniformTriple: v.StrictObjectSchema<{ readonly v3: v.TupleSchema<[typeof finiteUniform, typeof finiteUniform, typeof finiteUniform], undefined>; }, undefined> = v.strictObject({ v3: v.tuple([finiteUniform, finiteUniform, finiteUniform]) });
const UniformQuad: v.StrictObjectSchema<{ readonly v4: v.TupleSchema<[typeof finiteUniform, typeof finiteUniform, typeof finiteUniform, typeof finiteUniform], undefined>; }, undefined> = v.strictObject({ v4: v.tuple([finiteUniform, finiteUniform, finiteUniform, finiteUniform]) });
const FilamentRowsSchema: v.StrictObjectSchema<{ readonly uRes: typeof UniformPair; readonly uProjection: typeof UniformPair; readonly uCorePx: typeof finiteUniform; readonly uHaloPx: typeof finiteUniform; readonly uI: typeof finiteUniform; readonly uPulse: typeof finiteUniform; readonly uLen: typeof finiteUniform; readonly uTime: typeof finiteUniform; readonly uCore: typeof UniformTriple; readonly uHalo: typeof UniformTriple; }, undefined> = v.strictObject({ uRes: UniformPair, uProjection: UniformPair, uCorePx: finiteUniform, uHaloPx: finiteUniform,
  uI: finiteUniform, uPulse: finiteUniform, uLen: finiteUniform, uTime: finiteUniform, uCore: UniformTriple, uHalo: UniformTriple });
const HaloStateSchema: v.StrictObjectSchema<{ readonly blending: v.LiteralSchema<5, undefined>; readonly blendEquation: v.LiteralSchema<100, undefined>; readonly blendEquationAlpha: v.LiteralSchema<100, undefined>; readonly blendSrc: v.LiteralSchema<201, undefined>; readonly blendDst: v.LiteralSchema<201, undefined>; readonly blendSrcAlpha: v.LiteralSchema<200, undefined>; readonly blendDstAlpha: v.LiteralSchema<201, undefined>; }, undefined> = v.strictObject({ blending: v.literal(5), blendEquation: v.literal(100), blendEquationAlpha: v.literal(100),
  blendSrc: v.literal(201), blendDst: v.literal(201), blendSrcAlpha: v.literal(200), blendDstAlpha: v.literal(201) });
const GlowRowsSchema: v.StrictObjectSchema<{ readonly uGlow: typeof UniformQuad; readonly uGlow2: typeof UniformQuad; readonly uGlowCol: v.StrictObjectSchema<{ readonly rgb: typeof finiteUniform; }, undefined>; }, undefined> = v.strictObject({ uGlow: UniformQuad, uGlow2: UniformQuad, uGlowCol: v.strictObject({ rgb: finiteUniform }) });
/** Admit the authored ribbon tuples instead of relying on generated literal declarations. */
export function parseFilamentRows(value: unknown): GrappleRows['aim']['filament'] { return v.parse(FilamentRowsSchema, value); }
/** Preserve the existing additive-alpha material state at its data boundary. */
export function parseHaloState(value: unknown): GrappleRows['aim']['filamentState'] { return v.parse(HaloStateSchema, value); }
/** Composite uniforms retain their exact vector arity from ordinary authored JSON. */
export function parseGlowRows(value: unknown): v.InferOutput<typeof GlowRowsSchema> { return v.parse(GlowRowsSchema, value); }

const finite: v.NumberSchema<undefined> = v.number();
const SURFACES: readonly ["wood", "metal", "flesh", "felt", "stone", "rock", "sand", "water", "grass", "wetSand", "planks", "shell", "ground", "edge", "earth"] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand', 'water', 'grass', 'wetSand', 'planks', 'shell', 'ground', 'edge', 'earth'] as const;
const V3: v.TupleSchema<[typeof finite, typeof finite, typeof finite], undefined> = v.tuple([finite, finite, finite]);
const STYLES: readonly ["tube", "box", "plaque", "paper", "talisman", "etch", "banner"] = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'] as const;
const Spec: v.StrictObjectSchema<{ readonly text: v.StringSchema<undefined>; readonly color: v.StringSchema<undefined>; readonly vertical: v.BooleanSchema<undefined>; readonly style: v.PicklistSchema<typeof STYLES, undefined>; readonly ink: v.ExactOptionalSchema<v.StringSchema<undefined>, undefined>; }, undefined> = v.strictObject({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.picklist(STYLES), ink: v.exactOptional(v.string()) });
export const Place: v.StrictObjectSchema<{ readonly at: typeof V3; readonly normal: typeof V3; readonly size: typeof finite; readonly spec: typeof Spec; readonly gain: v.ExactOptionalSchema<typeof finite, undefined>; readonly flicker: v.ExactOptionalSchema<typeof finite, undefined>; readonly blade: v.ExactOptionalSchema<v.BooleanSchema<undefined>, undefined>; readonly board: v.ExactOptionalSchema<typeof finite, undefined>; readonly fogK: v.ExactOptionalSchema<typeof finite, undefined>; readonly clear: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined> = v.strictObject({
  at: V3, normal: V3, size: finite, spec: Spec, gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
  board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
});
/** Authored profile admission replaces generated JSON declaration shims. */
function profile<T extends v.ObjectEntries, P extends v.ObjectEntries>(entries: T, params: P) {
  const defaults = v.strictObject(entries);
  return v.strictObject({ defaults, variants: v.array(v.strictObject({ id: v.string(), label: v.string(), params: v.strictObject(params) })) });
}
const SignDefaultsSchema: v.StrictObjectSchema<{ readonly style: v.PicklistSchema<typeof STYLES, undefined>; readonly text: v.StringSchema<undefined>; readonly color: v.StringSchema<undefined>; readonly vertical: v.BooleanSchema<undefined>; readonly size: typeof finite; readonly blade: v.BooleanSchema<undefined>; readonly ink: v.ExactOptionalSchema<v.StringSchema<undefined>, undefined>; readonly board: v.ExactOptionalSchema<typeof finite, undefined>; readonly gain: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined> = v.strictObject({ style: v.picklist(STYLES), text: v.string(), color: v.string(), vertical: v.boolean(), size: finite,
  blade: v.boolean(), ink: v.exactOptional(v.string()), board: v.exactOptional(finite), gain: v.exactOptional(finite) });
const SignVariantSchema: v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ readonly style: v.PicklistSchema<typeof STYLES, undefined>; readonly text: v.StringSchema<undefined>; readonly color: v.StringSchema<undefined>; readonly vertical: v.BooleanSchema<undefined>; readonly size: typeof finite; readonly blade: v.ExactOptionalSchema<v.BooleanSchema<undefined>, undefined>; readonly ink: v.ExactOptionalSchema<v.StringSchema<undefined>, undefined>; readonly board: v.ExactOptionalSchema<typeof finite, undefined>; readonly gain: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>; }, undefined> = v.strictObject({ id: v.string(), label: v.string(), params: v.strictObject({
  style: v.picklist(STYLES), text: v.string(), color: v.string(), vertical: v.boolean(), size: finite,
  blade: v.exactOptional(v.boolean()), ink: v.exactOptional(v.string()), board: v.exactOptional(finite), gain: v.exactOptional(finite),
}) });
const SignViewSchema: v.StrictObjectSchema<{ readonly model: v.StrictObjectSchema<{ readonly key: v.StringSchema<undefined>; readonly calligraphyStyles: v.ArraySchema<v.StringSchema<undefined>, undefined>; readonly calligraphyGain: typeof finite; readonly tubeGain: typeof finite; readonly sideways: v.ArraySchema<v.StringSchema<undefined>, undefined>; readonly neonDepth: typeof finite; readonly bladeDepth: typeof finite; readonly depth: typeof finite; readonly standoff: typeof finite; readonly variantOf: v.RecordSchema<v.StringSchema<undefined>, v.StringSchema<undefined>, undefined>; readonly pieces: v.StrictObjectSchema<{ readonly atlas: v.StringSchema<undefined>; readonly neon: v.StringSchema<undefined>; }, undefined>; }, undefined>; readonly defaults: typeof SignDefaultsSchema; readonly variants: v.ArraySchema<typeof SignVariantSchema, undefined>; }, undefined> = v.strictObject({ model: v.strictObject({ key: v.string(), calligraphyStyles: v.array(v.string()),
  calligraphyGain: finite, tubeGain: finite, sideways: v.array(v.string()), neonDepth: finite, bladeDepth: finite,
  depth: finite, standoff: finite, variantOf: v.record(v.string(), v.string()), pieces: v.strictObject({ atlas: v.string(), neon: v.string() }) }),
  defaults: SignDefaultsSchema, variants: v.array(SignVariantSchema) });
const GateSchema: v.StrictObjectSchema<{ readonly posts: v.TupleSchema<[typeof finite, typeof finite, typeof finite, typeof finite], undefined>; readonly s: typeof finite; readonly plaque: v.StringSchema<undefined>; readonly couplets: v.NullableSchema<v.TupleSchema<[v.StringSchema<undefined>, v.StringSchema<undefined>], undefined>, undefined>; readonly neonEaves: v.NullableSchema<typeof finite, undefined>; readonly lions: v.BooleanSchema<undefined>; readonly k: v.ExactOptionalSchema<typeof finite, undefined>; readonly paint: v.ExactOptionalSchema<v.PicklistSchema<["mineral", "cinnabar"], undefined>, undefined>; }, undefined> = v.strictObject({ posts: v.tuple([finite, finite, finite, finite]), s: finite, plaque: v.string(),
  couplets: v.nullable(v.tuple([v.string(), v.string()])), neonEaves: v.nullable(finite), lions: v.boolean(),
  k: v.exactOptional(finite), paint: v.exactOptional(v.picklist(['mineral', 'cinnabar'])) });
const SpecimenProfilesSchema: v.StrictObjectSchema<{ readonly FIGURE_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ pose: v.PicklistSchema<["stand", "sit", "cook"], undefined>; umbrella: v.BooleanSchema<undefined>; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ pose: v.ExactOptionalSchema<v.PicklistSchema<["stand", "sit", "cook"], undefined>, undefined>; umbrella: v.ExactOptionalSchema<v.BooleanSchema<undefined>, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly HOOK_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ reach: typeof finite; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ reach: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly LAUNDRY_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ kind: v.PicklistSchema<["gallery", "lower", "pole"], undefined>; span: typeof finite; rise: typeof finite; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ kind: v.ExactOptionalSchema<v.PicklistSchema<["gallery", "lower", "pole"], undefined>, undefined>; span: v.ExactOptionalSchema<typeof finite, undefined>; rise: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly LOTUS_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ capped: v.BooleanSchema<undefined>; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ capped: v.ExactOptionalSchema<v.BooleanSchema<undefined>, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly PAIFANG: v.StrictObjectSchema<{ readonly square: typeof GateSchema; readonly stair: typeof GateSchema; readonly well: typeof GateSchema; }, undefined>; readonly PAIFANG_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ kind: v.PicklistSchema<["square", "stair", "well"], undefined>; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ kind: v.ExactOptionalSchema<v.PicklistSchema<["square", "stair", "well"], undefined>, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly SCOOTER_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ wash: typeof finite; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ wash: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; readonly STOOL_PROFILE: v.StrictObjectSchema<{ readonly defaults: v.StrictObjectSchema<{ wash: typeof finite; }, undefined>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.StringSchema<undefined>; readonly label: v.StringSchema<undefined>; readonly params: v.StrictObjectSchema<{ wash: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>; }, undefined>, undefined>; }, undefined>; }, undefined> = v.strictObject({
  FIGURE_PROFILE: profile({ pose: v.picklist(['stand', 'sit', 'cook']), umbrella: v.boolean() },
    { pose: v.exactOptional(v.picklist(['stand', 'sit', 'cook'])), umbrella: v.exactOptional(v.boolean()) }),
  HOOK_PROFILE: profile({ reach: finite }, { reach: v.exactOptional(finite) }),
  LAUNDRY_PROFILE: profile({ kind: v.picklist(['gallery', 'lower', 'pole']), span: finite, rise: finite },
    { kind: v.exactOptional(v.picklist(['gallery', 'lower', 'pole'])), span: v.exactOptional(finite), rise: v.exactOptional(finite) }),
  LOTUS_PROFILE: profile({ capped: v.boolean() }, { capped: v.exactOptional(v.boolean()) }),
  PAIFANG: v.strictObject({ square: GateSchema, stair: GateSchema, well: GateSchema }),
  PAIFANG_PROFILE: profile({ kind: v.picklist(['square', 'stair', 'well']) },
    { kind: v.exactOptional(v.picklist(['square', 'stair', 'well'])) }),
  SCOOTER_PROFILE: profile({ wash: finite }, { wash: v.exactOptional(finite) }), STOOL_PROFILE: profile({ wash: finite }, { wash: v.exactOptional(finite) }),
});
/** Validate without rebuilding the authored object: property order remains byte-significant to native rasters. */
export function parseSignView(value: unknown): v.InferOutput<typeof SignViewSchema> { v.assert(SignViewSchema, value); return value; }
/** Keep the authored defaults, partial variants and tuple positions; no emitted declaration is needed. */
export function parseSpecimenProfiles(value: unknown): v.InferOutput<typeof SpecimenProfilesSchema> { v.assert(SpecimenProfilesSchema, value); return value; }

const SignCall: v.VariantSchema<"k", [v.StrictObjectSchema<{ readonly k: v.LiteralSchema<"place", undefined>; readonly p: typeof Place; }, undefined>, v.StrictObjectSchema<{ readonly k: v.LiteralSchema<"light", undefined>; readonly c: typeof V3; readonly r: typeof V3; readonly u: typeof V3; readonly w: typeof finite; readonly h: typeof finite; readonly color: typeof finite; readonly gain: typeof finite; readonly mode: v.PicklistSchema<[1, 2], undefined>; readonly seed: typeof finite; }, undefined>, v.StrictObjectSchema<{ readonly k: v.LiteralSchema<"tube", undefined>; readonly a: typeof V3; readonly b: typeof V3; readonly f: typeof V3; readonly width: typeof finite; readonly color: typeof finite; readonly gain: typeof finite; readonly flicker: typeof finite; }, undefined>], undefined> = v.variant('k', [
  v.strictObject({ k: v.literal('place'), p: Place }),
  v.strictObject({ k: v.literal('light'), c: V3, r: V3, u: V3, w: finite, h: finite, color: finite, gain: finite, mode: v.picklist([1, 2] as const), seed: finite }),
  v.strictObject({ k: v.literal('tube'), a: V3, b: V3, f: V3, width: finite, color: finite, gain: finite, flicker: finite }),
]);
const Geometry: v.StrictObjectSchema<{ readonly attrs: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, v.PicklistSchema<["f32", "f16", "u16", "i8", "u8"], undefined>, typeof finite, v.BooleanSchema<undefined>], undefined>, undefined>; readonly count: typeof finite; readonly index: v.NullableSchema<v.PicklistSchema<["u16", "u32"], undefined>, undefined>; readonly indexCount: typeof finite; readonly box: v.BooleanSchema<undefined>; }, undefined> = v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8'] as const), finite, v.boolean()])),
  count: finite, index: v.nullable(v.picklist(['u16', 'u32'] as const)), indexCount: finite, box: v.boolean(),
});
const Slot: v.StrictObjectSchema<{ readonly at: typeof V3; readonly normal: typeof V3; readonly size: typeof finite; readonly color: typeof finite; readonly blade: v.BooleanSchema<undefined>; }, undefined> = v.strictObject({ at: V3, normal: V3, size: finite, color: finite, blade: v.boolean() });
const Named: v.StrictObjectSchema<{ readonly name: v.StringSchema<undefined>; readonly geo: typeof finite; }, undefined> = v.strictObject({ name: v.string(), geo: finite });
const KINDS: readonly ["block", "street", "well", "plaza", "green", "gate"] = ['block', 'street', 'well', 'plaza', 'green', 'gate'] as const;
const Params: v.RecordSchema<v.StringSchema<undefined>, v.UnionSchema<[typeof finite, v.StringSchema<undefined>, v.BooleanSchema<undefined>], undefined>, undefined> = v.record(v.string(), v.union([finite, v.string(), v.boolean()]));
const Box: v.StrictObjectSchema<{ readonly kind: v.LiteralSchema<"box", undefined>; readonly x: typeof finite; readonly y: typeof finite; readonly z: typeof finite; readonly hx: typeof finite; readonly hy: typeof finite; readonly hz: typeof finite; readonly yaw: v.ExactOptionalSchema<typeof finite, undefined>; readonly rot: v.ExactOptionalSchema<v.StrictObjectSchema<{ readonly x: typeof finite; readonly y: typeof finite; readonly z: typeof finite; readonly w: typeof finite; }, undefined>, undefined>; readonly surface: v.ExactOptionalSchema<v.PicklistSchema<typeof SURFACES, undefined>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
  yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface: v.exactOptional(v.picklist(SURFACES)) });

/** the bake's rows (the binary's JSON head), strictly */
export const LayoutRowsSchema: v.StrictObjectSchema<{ readonly version: v.LiteralSchema<1, undefined>; readonly geometries: v.ArraySchema<typeof Geometry, undefined>; readonly kits: v.ArraySchema<v.StrictObjectSchema<{ readonly name: v.StringSchema<undefined>; readonly geo: v.NullableSchema<typeof finite, undefined>; readonly compact: v.BooleanSchema<undefined>; }, undefined>, undefined>; readonly alphaKits: v.ArraySchema<typeof Named, undefined>; readonly kitxs: v.ArraySchema<typeof Named, undefined>; readonly reflective: v.ArraySchema<v.StringSchema<undefined>, undefined>; readonly farOf: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, typeof finite], undefined>, undefined>; readonly counts: v.StrictObjectSchema<{ readonly walkers: typeof finite; readonly sitters: typeof finite; readonly lanterns: typeof finite; readonly acs: typeof finite; readonly hooks: typeof finite; readonly hookMounts: typeof finite; readonly steam: typeof finite; readonly pieces: typeof finite; readonly windows: typeof finite; readonly lions: typeof finite; }, undefined>; readonly inKit: v.ArraySchema<v.StrictObjectSchema<{ readonly model: v.StringSchema<undefined>; readonly kit: v.StringSchema<undefined>; readonly at: v.StrictObjectSchema<{ readonly x: typeof finite; readonly y: typeof finite; readonly z: typeof finite; readonly yaw: v.ExactOptionalSchema<typeof finite, undefined>; readonly variant: v.ExactOptionalSchema<v.StringSchema<undefined>, undefined>; readonly params: v.ExactOptionalSchema<typeof Params, undefined>; }, undefined>; readonly box: v.TupleSchema<[typeof finite, typeof finite, typeof finite, typeof finite, typeof finite, typeof finite], undefined>; }, undefined>, undefined>; readonly map: v.ArraySchema<v.StrictObjectSchema<{ readonly x0: typeof finite; readonly z0: typeof finite; readonly x1: typeof finite; readonly z1: typeof finite; readonly kind: v.PicklistSchema<typeof KINDS, undefined>; }, undefined>, undefined>; readonly emitters: v.ArraySchema<v.StrictObjectSchema<{ readonly at: typeof V3; readonly color: typeof V3; readonly w: typeof finite; readonly h: typeof finite; readonly power: typeof finite; readonly spill: typeof finite; }, undefined>, undefined>; readonly pieces: v.ArraySchema<v.StringSchema<undefined>, undefined>; readonly slots: v.StrictObjectSchema<{ readonly early: v.ArraySchema<typeof Slot, undefined>; readonly late: v.ArraySchema<typeof Slot, undefined>; }, undefined>; readonly shell: v.NullableSchema<typeof finite, undefined>; readonly towers: typeof finite; readonly merged: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, v.TupleSchema<[typeof finite, typeof finite, typeof finite, typeof finite, typeof finite, typeof finite], undefined>], undefined>, undefined>; readonly inst: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, typeof finite], undefined>, undefined>; readonly rng: v.StrictObjectSchema<{ readonly version: typeof finite; readonly state: typeof finite; readonly initial: typeof finite; readonly scrambledFork: v.BooleanSchema<undefined>; }, undefined>; readonly signs: v.ArraySchema<typeof SignCall, undefined>; readonly crossings: v.ArraySchema<typeof Box, undefined>; readonly sets: v.ArraySchema<v.StrictObjectSchema<{ readonly name: v.StringSchema<undefined>; readonly geo: typeof finite; readonly count: typeof finite; }, undefined>, undefined>; readonly sheets: v.ArraySchema<v.StrictObjectSchema<{ readonly y: typeof finite; readonly band: typeof finite; readonly a: typeof finite; }, undefined>, undefined>; readonly banyan: v.NullableSchema<v.StrictObjectSchema<{ readonly lumps: v.ArraySchema<v.StrictObjectSchema<{ readonly c: typeof V3; readonly r: typeof V3; readonly up: typeof finite; readonly seed: typeof finite; readonly wash: typeof finite; }, undefined>, undefined>; readonly hangs: v.ArraySchema<typeof V3, undefined>; }, undefined>, undefined>; }, undefined> = v.strictObject({
  version: v.literal(1),
  geometries: v.array(Geometry),
  kits: v.array(v.strictObject({ name: v.string(), geo: v.nullable(finite), compact: v.boolean() })),
  alphaKits: v.array(Named),
  kitxs: v.array(Named),
  reflective: v.array(v.string()),
  farOf: v.array(v.tuple([v.string(), finite])),
  counts: v.strictObject({ walkers: finite, sitters: finite, lanterns: finite, acs: finite, hooks: finite, hookMounts: finite, steam: finite, pieces: finite, windows: finite, lions: finite }),
  inKit: v.array(v.strictObject({ model: v.string(), kit: v.string(), at: v.strictObject({ x: finite, y: finite, z: finite, yaw: v.exactOptional(finite), variant: v.exactOptional(v.string()), params: v.exactOptional(Params) }), box: v.tuple([finite, finite, finite, finite, finite, finite]) })),
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
/** Only the layout maps and poses used by the client, decoded from the author record stream offline. */
export const LayoutProjectionSchema: v.StrictObjectSchema<{ 
// `s`: the geometry's float32 box [min, max] in shortest digits and its sphere radius; the sphere centre is the box's
readonly geometries: v.ArraySchema<v.StrictObjectSchema<{ readonly id: typeof finite; readonly box: v.BooleanSchema<undefined>; readonly s: v.TupleSchema<[typeof finite, typeof finite, typeof finite, typeof finite, typeof finite, typeof finite, typeof finite], undefined>; }, undefined>, undefined>; readonly kits: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, v.NullableSchema<typeof finite, undefined>], undefined>, undefined>; readonly alphaKits: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, typeof finite], undefined>, undefined>; readonly farOf: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, typeof finite], undefined>, undefined>; readonly inKit: v.ArraySchema<v.StrictObjectSchema<{ readonly model: v.StringSchema<undefined>; readonly kit: v.StringSchema<undefined>; readonly at: v.StrictObjectSchema<{ readonly x: typeof finite; readonly y: typeof finite; readonly z: typeof finite; readonly yaw: v.ExactOptionalSchema<typeof finite, undefined>; readonly variant: v.ExactOptionalSchema<v.StringSchema<undefined>, undefined>; readonly params: v.ExactOptionalSchema<typeof Params, undefined>; }, undefined>; readonly box: v.TupleSchema<[typeof finite, typeof finite, typeof finite, typeof finite, typeof finite, typeof finite], undefined>; }, undefined>, undefined>; readonly shell: v.NullableSchema<typeof finite, undefined>; readonly lanterns: v.ArraySchema<v.ArraySchema<typeof finite, undefined>, undefined>; readonly acs: v.ArraySchema<v.ArraySchema<typeof finite, undefined>, undefined>; readonly hooks: v.ArraySchema<typeof V3, undefined>; readonly fixed: v.StrictObjectSchema<{ readonly lanterns: v.ArraySchema<v.ArraySchema<typeof finite, undefined>, undefined>; readonly drop: typeof finite; }, undefined>; readonly hookMounts: v.ArraySchema<v.StrictObjectSchema<{ readonly ring: typeof V3; readonly out: typeof V3; }, undefined>, undefined>; readonly inst: v.ArraySchema<v.TupleSchema<[v.StringSchema<undefined>, v.ArraySchema<v.StrictObjectSchema<{ readonly matrix: v.ArraySchema<typeof finite, undefined>; readonly color: typeof V3; }, undefined>, undefined>], undefined>, undefined>; }, undefined> = v.strictObject({
  // `s`: the geometry's float32 box [min, max] in shortest digits and its sphere radius; the sphere centre is the box's
  geometries: v.array(v.strictObject({ id: finite, box: v.boolean(), s: v.tuple([finite, finite, finite, finite, finite, finite, finite]) })),
  kits: v.array(v.tuple([v.string(), v.nullable(finite)])), alphaKits: v.array(v.tuple([v.string(), finite])),
  farOf: LayoutRowsSchema.entries.farOf, inKit: LayoutRowsSchema.entries.inKit, shell: v.nullable(finite),
  lanterns: v.array(v.array(finite)), acs: v.array(v.array(finite)), hooks: v.array(V3),
  fixed: v.strictObject({ lanterns: v.array(v.array(finite)), drop: finite }),
  hookMounts: v.array(v.strictObject({ ring: V3, out: V3 })),
  inst: v.array(v.tuple([v.string(), v.array(v.strictObject({ matrix: v.array(finite), color: V3 }))])),
});
export type LayoutProjection = v.InferOutput<typeof LayoutProjectionSchema>;

export type SignCallRow = v.InferOutput<typeof SignCall>;
export type BakedPlace = v.InferOutput<typeof Place>;



const text: v.StringSchema<undefined> = v.string();
export const GeometryLibrarySchema: v.StrictObjectSchema<{ readonly layout: v.ArraySchema<typeof text, undefined>; readonly boot: v.ArraySchema<typeof text, undefined>; readonly explorer: v.ArraySchema<typeof text, undefined>; readonly specimenBoxes: v.RecordSchema<typeof text, v.BooleanSchema<undefined>, undefined>; readonly records: v.SchemaWithPipe<readonly [typeof finite, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4000000, undefined>]>; readonly layoutDraws: v.SchemaWithPipe<readonly [typeof finite, v.IntegerAction<number, undefined>, v.MinValueAction<number, 1, undefined>, v.MaxValueAction<number, 122, undefined>]>; }, undefined> = v.strictObject({ layout: v.array(text), boot: v.array(text), explorer: v.array(text),
  specimenBoxes: v.record(text, v.boolean()), records: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_000_000)),
  layoutDraws: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(122)) });
/** Named blob types only; this declaration adds no custom output section. */
export const SECTIONS: NonNullable<unknown> = {};

const Offset: v.SchemaWithPipe<readonly [typeof finite, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>]> = v.pipe(v.number(), v.integer(), v.minValue(0));
const CrowdCopy: v.StrictObjectSchema<{ readonly variant: typeof text; readonly matrix: typeof Offset; }, undefined> = v.strictObject({ variant: v.string(), matrix: Offset });
const Rect: v.StrictObjectSchema<{ readonly x0: typeof finite; readonly z0: typeof finite; readonly x1: typeof finite; readonly z1: typeof finite; }, undefined> = v.strictObject({ x0: finite, z0: finite, x1: finite, z1: finite });
/** Matrix/color offsets index the declared float64 world buffer, never executable JSON. */
export const WorldRowsSchema: v.StrictObjectSchema<{ readonly records: typeof Offset; readonly sheetLayers: v.ArraySchema<v.StrictObjectSchema<{ readonly dy: typeof finite; readonly alpha: typeof finite; }, undefined>, undefined>; readonly steamPuffs: v.StrictObjectSchema<{ readonly perPoint: typeof finite; readonly stride: typeof finite; }, undefined>; readonly lions: v.ArraySchema<typeof Offset, undefined>; readonly shares: v.StrictObjectSchema<{ readonly plaza: v.ArraySchema<typeof Offset, undefined>; readonly street: v.ArraySchema<typeof Offset, undefined>; readonly rim: v.ArraySchema<typeof Offset, undefined>; }, undefined>; readonly sets: v.ArraySchema<v.StrictObjectSchema<{ readonly name: typeof text; readonly geo: typeof Offset; readonly count: typeof Offset; readonly frames: v.ArraySchema<typeof Offset, undefined>; }, undefined>, undefined>; readonly crowd: v.StrictObjectSchema<{ readonly walkers: v.ArraySchema<typeof CrowdCopy, undefined>; readonly sitters: v.ArraySchema<typeof CrowdCopy, undefined>; }, undefined>; readonly floors: v.ArraySchema<v.StrictObjectSchema<{ readonly x: typeof finite; readonly z: typeof finite; readonly hw: typeof finite; readonly hd: typeof finite; readonly y: typeof finite; }, undefined>, undefined>; readonly regions: v.ArraySchema<v.StrictObjectSchema<{ readonly id: typeof text; readonly name: typeof text; readonly place: typeof text; readonly extra: typeof text; readonly kits: v.ArraySchema<typeof text, undefined>; }, undefined>, undefined>; readonly shaft: typeof Rect; readonly wellRects: v.ArraySchema<typeof Rect, undefined>; readonly rim: v.StrictObjectSchema<{ readonly z0: typeof finite; readonly z1: typeof finite; }, undefined>; readonly crossings: v.ArraySchema<typeof Box, undefined>; readonly sheets: v.ArraySchema<v.StrictObjectSchema<{ readonly y: typeof finite; readonly band: typeof finite; readonly a: typeof finite; }, undefined>, undefined>; readonly portalLanterns: v.ArraySchema<typeof Offset, undefined>; readonly facade: v.StrictObjectSchema<{ readonly drawn: v.ArraySchema<v.StrictObjectSchema<{ readonly id: typeof text; readonly poses: typeof Offset; readonly count: typeof Offset; readonly small: v.BooleanSchema<undefined>; }, undefined>, undefined>; readonly baked: v.ArraySchema<v.StrictObjectSchema<{ readonly id: typeof text; readonly poses: typeof Offset; readonly count: typeof Offset; readonly boxes: typeof Offset; }, undefined>, undefined>; }, undefined>; }, undefined> = v.strictObject({
  records: Offset, sheetLayers: v.array(v.strictObject({ dy: finite, alpha: finite })), steamPuffs: v.strictObject({ perPoint: finite, stride: finite }),
  lions: v.array(Offset), shares: v.strictObject({ plaza: v.array(Offset), street: v.array(Offset), rim: v.array(Offset) }),
  sets: v.array(v.strictObject({ name: v.string(), geo: Offset, count: Offset, frames: v.array(Offset) })),
  crowd: v.strictObject({ walkers: v.array(CrowdCopy), sitters: v.array(CrowdCopy) }),
  floors: v.array(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, y: finite })),
  regions: v.array(v.strictObject({ id: v.string(), name: v.string(), place: v.string(), extra: v.string(), kits: v.array(v.string()) })),
  shaft: Rect, wellRects: v.array(Rect), rim: v.strictObject({ z0: finite, z1: finite }), crossings: v.array(Box),
  sheets: v.array(v.strictObject({ y: finite, band: finite, a: finite })), portalLanterns: v.array(Offset),
  facade: v.strictObject({ drawn: v.array(v.strictObject({ id: v.string(), poses: Offset, count: Offset, small: v.boolean() })),
    baked: v.array(v.strictObject({ id: v.string(), poses: Offset, count: Offset, boxes: Offset })) }),
});
export type WorldRows = v.InferOutput<typeof WorldRowsSchema>;

export const GeometryBootSchema: v.StrictObjectSchema<{ readonly rows: typeof LayoutRowsSchema; readonly library: typeof GeometryLibrarySchema; readonly negativeZeros: v.ArraySchema<v.ArraySchema<typeof text, undefined>, undefined>; readonly world: typeof WorldRowsSchema; }, undefined> = v.strictObject({ rows: LayoutRowsSchema, library: GeometryLibrarySchema,
  negativeZeros: v.array(v.array(text)), world: WorldRowsSchema });

const Course: v.StrictObjectSchema<{ readonly id: typeof text; readonly title: typeof text; readonly chip: typeof text; readonly piece: v.StrictObjectSchema<{ readonly id: typeof text; readonly name: typeof text; readonly file: typeof text; readonly surface: typeof text; }, undefined>; readonly room: v.StrictObjectSchema<{ readonly x0: typeof finite; readonly x1: typeof finite; readonly z0: typeof finite; readonly z1: typeof finite; readonly height: typeof finite; }, undefined>; readonly ringUp: typeof finite; readonly ringOut: typeof finite; readonly fallY: typeof finite; readonly slab: typeof finite; readonly pads: v.SchemaWithPipe<readonly [v.ArraySchema<v.StrictObjectSchema<{ readonly id: typeof text; readonly label: typeof text; readonly x: typeof finite; readonly z: typeof finite; readonly w: typeof finite; readonly d: typeof finite; readonly top: typeof finite; readonly kind: typeof text; readonly next: v.ExactOptionalSchema<typeof text, undefined>; }, undefined>, undefined>, v.MaxLengthAction<{ id: string; label: string; x: number; z: number; w: number; d: number; top: number; kind: string; next?: string; }[], 256, undefined>]>; readonly column: v.StrictObjectSchema<{ readonly x: typeof finite; readonly z: typeof finite; readonly w: typeof finite; readonly d: typeof finite; }, undefined>; readonly hooks: v.SchemaWithPipe<readonly [v.ArraySchema<v.StrictObjectSchema<{ readonly pad: typeof text; readonly edge: typeof text; readonly along: v.ExactOptionalSchema<typeof finite, undefined>; }, undefined>, undefined>, v.MaxLengthAction<{ pad: string; edge: string; along?: number; }[], 256, undefined>]>; readonly run: v.StrictObjectSchema<{ readonly from: typeof text; readonly to: typeof text; readonly goals: typeof finite; }, undefined>; readonly words: v.StrictObjectSchema<{ readonly ready: typeof text; readonly finish: typeof text; readonly running: typeof text; readonly between: typeof text; readonly done: typeof text; readonly best: typeof text; readonly fell: typeof text; }, undefined>; readonly look: v.StrictObjectSchema<{ readonly ceiling: typeof finite; readonly ring: typeof finite; readonly mast: typeof finite; readonly paint: typeof finite; readonly label: typeof text; readonly startLabel: typeof text; readonly finishLabel: typeof text; readonly map: v.StrictObjectSchema<{ readonly floor: typeof text; readonly grid: typeof text; readonly wall: typeof text; readonly column: typeof text; readonly lit: typeof text; readonly pad: typeof text; readonly finish: typeof text; readonly hook: typeof text; readonly label: typeof text; }, undefined>; }, undefined>; }, undefined> = v.strictObject({
  id: v.string(), title: v.string(), chip: v.string(),
  piece: v.strictObject({ id: v.string(), name: v.string(), file: v.string(), surface: v.string() }),
  room: v.strictObject({ x0: finite, x1: finite, z0: finite, z1: finite, height: finite }),
  ringUp: finite, ringOut: finite, fallY: finite, slab: finite,
  pads: v.pipe(v.array(v.strictObject({ id: v.string(), label: v.string(), x: finite, z: finite, w: finite, d: finite, top: finite, kind: v.string(), next: v.exactOptional(v.string()) })), v.maxLength(256)),
  column: v.strictObject({ x: finite, z: finite, w: finite, d: finite }),
  hooks: v.pipe(v.array(v.strictObject({ pad: v.string(), edge: v.string(), along: v.exactOptional(finite) })), v.maxLength(256)),
  run: v.strictObject({ from: v.string(), to: v.string(), goals: finite }),
  words: v.strictObject({ ready: v.string(), finish: v.string(), running: v.string(), between: v.string(), done: v.string(), best: v.string(), fell: v.string() }),
  look: v.strictObject({ ceiling: finite, ring: finite, mast: finite, paint: finite, label: v.string(), startLabel: v.string(), finishLabel: v.string(),
    map: v.strictObject({ floor: v.string(), grid: v.string(), wall: v.string(), column: v.string(), lit: v.string(), pad: v.string(), finish: v.string(), hook: v.string(), label: v.string() }) }),
});
export const FixedRowsSchema: v.StrictObjectSchema<{ readonly signs: v.ArraySchema<typeof SignCall, undefined>; readonly lanterns: v.ArraySchema<v.ArraySchema<typeof finite, undefined>, undefined>; readonly lantern: v.StrictObjectSchema<{ readonly drop: typeof finite; readonly glow: v.StrictObjectSchema<{ readonly color: typeof finite; readonly w: typeof finite; readonly h: typeof finite; readonly power: typeof finite; readonly spill: typeof finite; }, undefined>; }, undefined>; readonly practice: v.StrictObjectSchema<{ readonly controller: typeof PracticeControllerSchema; readonly program: typeof ReturnProgramSchema; readonly sampleEpsilon: v.PicklistSchema<[0, 1e-9], undefined>; readonly frame: v.SchemaWithPipe<readonly [v.RecordSchema<typeof text, typeof finite, undefined>, v.MaxEntriesAction<Record<string, number>, 115, undefined>]>; readonly presentation: v.UnknownSchema; readonly hooks: v.SchemaWithPipe<readonly [v.ArraySchema<v.StrictObjectSchema<{ readonly pad: typeof text; readonly x: typeof finite; readonly y: typeof finite; readonly z: typeof finite; }, undefined>, undefined>, v.MaxLengthAction<{ pad: string; x: number; y: number; z: number; }[], 256, undefined>]>; readonly course: typeof Course; }, undefined>; }, undefined> = v.strictObject({ signs: v.array(SignCall), lanterns: v.array(v.array(v.number())),
  lantern: v.strictObject({ drop: v.number(), glow: v.strictObject({ color: v.number(), w: v.number(), h: v.number(), power: v.number(), spill: v.number() }) }),
  practice: v.strictObject({ controller:PracticeControllerSchema, program: ReturnProgramSchema, sampleEpsilon:v.picklist([0,1e-9]), frame: v.pipe(v.record(v.string(), finite), v.maxEntries(115)), presentation: v.unknown(), hooks: v.pipe(v.array(v.strictObject({ pad: v.string(), x: finite, y: finite, z: finite })), v.maxLength(256)), course: Course }),
});

const N: typeof finite = v.number();
export const SignAtlasSchema: v.StrictObjectSchema<{ readonly glyphLayout: v.StrictObjectSchema<{ readonly cell: typeof N; readonly fontPx: typeof N; readonly spread: typeof N; readonly skeletonSpread: typeof N; }, undefined>; readonly keys: v.RecordSchema<typeof text, typeof text, undefined>; readonly pools: v.ArraySchema<v.StrictObjectSchema<{ readonly name: typeof text; readonly parts: v.ArraySchema<typeof text, undefined>; }, undefined>, undefined>; readonly channels: v.ArraySchema<v.StrictObjectSchema<{ readonly name: typeof text; readonly source: typeof text; readonly width: typeof N; readonly parts: v.ExactOptionalSchema<v.ArraySchema<typeof text, undefined>, undefined>; }, undefined>, undefined>; readonly lights: v.ArraySchema<v.StrictObjectSchema<{ readonly at: typeof V3; readonly color: typeof V3; readonly w: typeof N; readonly h: typeof N; readonly power: typeof N; readonly spill: typeof N; }, undefined>, undefined>; readonly neonLights: v.ArraySchema<v.StrictObjectSchema<{ readonly at: typeof V3; readonly color: typeof V3; readonly w: typeof N; readonly h: typeof N; readonly power: typeof N; readonly spill: typeof N; }, undefined>, undefined>; readonly copies: v.ArraySchema<v.StrictObjectSchema<{ readonly neon: v.BooleanSchema<undefined>; readonly boxes: v.ArraySchema<typeof N, undefined>; readonly poses: v.ArraySchema<v.StrictObjectSchema<{ readonly x: typeof N; readonly y: typeof N; readonly z: typeof N; readonly yaw: typeof N; readonly variant: typeof text; readonly params: v.RecordSchema<typeof text, v.UnknownSchema, undefined>; }, undefined>, undefined>; }, undefined>, undefined>; }, undefined> = v.strictObject({
  glyphLayout: v.strictObject({ cell: N, fontPx: N, spread: N, skeletonSpread: N }),
  keys: v.record(v.string(), v.string()),
  pools: v.array(v.strictObject({ name: v.string(), parts: v.array(v.string()) })),
  channels: v.array(v.strictObject({ name: v.string(), source: v.string(), width: N, parts: v.exactOptional(v.array(v.string())) })),
  lights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  neonLights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  copies: v.array(v.strictObject({ neon: v.boolean(), boxes: v.array(N), poses: v.array(v.strictObject({ x: N, y: N, z: N, yaw: N, variant: v.string(), params: v.record(v.string(), v.unknown()) })) })),
});

/** Named practice files retain the defining bounded scene contract. */
export const FixedPracticeFileSchema: v.StrictObjectSchema<{ readonly practice: v.StrictObjectSchema<{ readonly presentation: typeof PracticeSceneSchema; readonly controller: typeof PracticeControllerSchema; readonly program: typeof ReturnProgramSchema; readonly sampleEpsilon: v.PicklistSchema<[0, 1e-9], undefined>; readonly frame: v.SchemaWithPipe<readonly [v.RecordSchema<typeof text, typeof N, undefined>, v.MaxEntriesAction<Record<string, number>, 115, undefined>]>; readonly hooks: v.SchemaWithPipe<readonly [v.ArraySchema<v.StrictObjectSchema<{ readonly pad: typeof text; readonly x: typeof N; readonly y: typeof N; readonly z: typeof N; }, undefined>, undefined>, v.MaxLengthAction<{ pad: string; x: number; y: number; z: number; }[], 256, undefined>]>; readonly course: typeof Course; }, undefined>; }, undefined>=v.strictObject({practice:v.strictObject({...FixedRowsSchema.entries.practice.entries,presentation:PracticeSceneSchema})});

/** Admit only the named practice payload through the same complete defining contract. */
export function parseFixedPractice(value: unknown): v.InferOutput<typeof FixedPracticeFileSchema> {
  return v.parse(FixedPracticeFileSchema, value);
}

/** Validate the course with its defining public schema before serializing it. */
export function parseFixedRows(value: unknown): Omit<v.InferOutput<typeof FixedRowsSchema>, 'practice'> & { practice: Omit<v.InferOutput<typeof FixedRowsSchema>['practice'], 'presentation'> & { presentation: v.InferOutput<typeof PracticeSceneSchema> } } {
  const row = v.parse(FixedRowsSchema, JSON.parse(JSON.stringify(value), (_key, entry: unknown) => entry === '-0' ? -0 : entry));
  return { ...row, practice: { ...row.practice, presentation: v.parse(PracticeSceneSchema, row.practice.presentation) } };
}

const HeldScalar: typeof finiteUniform = v.pipe(v.number(), v.finite());
const HeldIndex: v.SchemaWithPipe<readonly [typeof N, v.SafeIntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>]> = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const HeldMeshSchema: v.StrictObjectSchema<{ readonly name: typeof text; readonly look: typeof text; readonly attributes: v.ArraySchema<typeof text, undefined>; readonly channels: v.RecordSchema<typeof text, typeof text, undefined>; readonly hull: v.BooleanSchema<undefined>; readonly width: typeof HeldScalar; readonly maps: typeof text; readonly rotation: v.SchemaWithPipe<readonly [v.ArraySchema<typeof HeldScalar, undefined>, v.LengthAction<number[], 9, undefined>]>; readonly doubleSide: v.BooleanSchema<undefined>; }, undefined> = v.strictObject({
  name: v.string(), look: v.string(), attributes: v.array(v.string()), channels: v.record(v.string(), v.string()),
  hull: v.boolean(), width: HeldScalar, maps: v.string(), rotation: v.pipe(v.array(HeldScalar), v.length(9)), doubleSide: v.boolean(),
});
const HeldMeshesSchema: v.SchemaWithPipe<readonly [v.ArraySchema<typeof HeldMeshSchema, undefined>, v.MinLengthAction<{ name: string; look: string; attributes: string[]; channels: Record<string, string>; hull: boolean; width: number; maps: string; rotation: number[]; doubleSide: boolean; }[], 1, undefined>, v.MaxLengthAction<{ name: string; look: string; attributes: string[]; channels: Record<string, string>; hull: boolean; width: number; maps: string; rotation: number[]; doubleSide: boolean; }[], 64, undefined>]> = v.pipe(v.array(HeldMeshSchema), v.minLength(1), v.maxLength(64));
const HeldRigSourceSchema: v.ObjectSchema<{ readonly nodes: v.ArraySchema<v.ObjectSchema<{ readonly mesh: v.ExactOptionalSchema<typeof HeldIndex, undefined>; readonly name: v.ExactOptionalSchema<typeof text, undefined>; readonly skin: v.ExactOptionalSchema<typeof HeldIndex, undefined>; readonly extras: v.ExactOptionalSchema<v.ObjectSchema<{ readonly hull: v.ExactOptionalSchema<v.BooleanSchema<undefined>, undefined>; readonly hullK: v.ExactOptionalSchema<typeof HeldScalar, undefined>; readonly maps: v.ExactOptionalSchema<typeof text, undefined>; readonly assetRot: v.ExactOptionalSchema<v.SchemaWithPipe<readonly [v.ArraySchema<typeof HeldScalar, undefined>, v.LengthAction<number[], 9, undefined>]>, undefined>; }, undefined>, undefined>; }, undefined>, undefined>; readonly meshes: v.ArraySchema<v.ObjectSchema<{ readonly primitives: v.ArraySchema<v.ObjectSchema<{ readonly attributes: v.RecordSchema<typeof text, v.UnknownSchema, undefined>; }, undefined>, undefined>; }, undefined>, undefined>; }, undefined> = v.object({
  nodes: v.array(v.object({ mesh: v.exactOptional(HeldIndex), name: v.exactOptional(v.string()), skin: v.exactOptional(HeldIndex),
    extras: v.exactOptional(v.object({ hull: v.exactOptional(v.boolean()), hullK: v.exactOptional(HeldScalar), maps: v.exactOptional(v.string()),
      assetRot: v.exactOptional(v.pipe(v.array(HeldScalar), v.length(9))) })) })),
  meshes: v.array(v.object({ primitives: v.array(v.object({ attributes: v.record(v.string(), v.unknown()) })) })),
});

/** Original held-GLB mesh metadata; raw source and cached results share one admission. */
export type NineHeldMesh = v.InferOutput<typeof HeldMeshSchema>;
/** Read only the authored mesh/attribute/extras declarations, never geometry or image bytes. */
export function parseHeldRigSource(value: unknown): v.InferOutput<typeof HeldRigSourceSchema> { return v.parse(HeldRigSourceSchema, value); }
/** Admit complete original mesh rows and their existing 1..64 mesh bound. */
export function parseHeldMeshes(value: unknown): readonly NineHeldMesh[] { return v.parse(HeldMeshesSchema, value); }


const WorldHash: v.SchemaWithPipe<readonly [typeof text, v.RegexAction<string, undefined>]> = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const WorldHeaderSchema: v.StrictObjectSchema<{ readonly version: v.LiteralSchema<1, undefined>; readonly notice: typeof text; readonly libraries: v.StrictObjectSchema<{ readonly layout: v.ArraySchema<typeof WorldHash, undefined>; readonly boot: v.ArraySchema<typeof WorldHash, undefined>; readonly explorer: v.ArraySchema<typeof WorldHash, undefined>; }, undefined>; readonly specimenBoxes: v.RecordSchema<typeof text, v.BooleanSchema<undefined>, undefined>; readonly shardfile: v.RecordSchema<typeof text, v.UnknownSchema, undefined>; readonly props: v.NullableSchema<v.RecordSchema<typeof text, v.UnknownSchema, undefined>, undefined>; readonly report: v.ArraySchema<v.RecordSchema<typeof text, v.UnknownSchema, undefined>, undefined>; }, undefined> = v.strictObject({
  version: v.literal(1), notice: v.string(),
  libraries: v.strictObject({ layout: v.array(WorldHash), boot: v.array(WorldHash), explorer: v.array(WorldHash) }),
  specimenBoxes: v.record(v.string(), v.boolean()), shardfile: v.record(v.string(), v.unknown()),
  props: v.nullable(v.record(v.string(), v.unknown())), report: v.array(v.record(v.string(), v.unknown())),
});
const WorldLayoutSchema: v.StrictObjectSchema<{ readonly version: v.LiteralSchema<1, undefined>; readonly count: v.SchemaWithPipe<readonly [typeof N, v.SafeIntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4000000, undefined>]>; readonly records: v.ArraySchema<v.UnknownSchema, undefined>; readonly rows: v.UnknownSchema; readonly bounds: v.ArraySchema<v.StrictObjectSchema<{ readonly sphere: v.SchemaWithPipe<readonly [v.ArraySchema<typeof N, undefined>, v.LengthAction<number[], 4, undefined>]>; readonly box: v.SchemaWithPipe<readonly [v.ArraySchema<typeof N, undefined>, v.LengthAction<number[], 6, undefined>]>; }, undefined>, undefined>; }, undefined> = v.strictObject({ version: v.literal(1), count: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(4_000_000)),
  records: v.array(v.unknown()), rows: v.unknown(), bounds: v.array(v.strictObject({ sphere: v.pipe(v.array(finite), v.length(4)), box: v.pipe(v.array(finite), v.length(6)) })) });
/** Admit the owned world envelope before the defining shardfile reader validates its file and tile rows. */
export function parseWorldHeader(value: unknown): v.InferOutput<typeof WorldHeaderSchema> { return v.parse(WorldHeaderSchema, value); }
/** Preserve signed/nonfinite layout words until the existing layout admission revives them. */
export function parseWorldLayout(value: unknown): v.InferOutput<typeof WorldLayoutSchema> { return v.parse(WorldLayoutSchema, value); }

const CastHookSchema: v.StrictObjectSchema<{ readonly glb: v.LiteralSchema<"castHook.generated.glb", undefined>; readonly material: v.StrictObjectSchema<{ readonly color: typeof V3; readonly side: v.PicklistSchema<[0, 1, 2], undefined>; readonly normalScale: v.TupleSchema<[typeof N, typeof N], undefined>; readonly emissive: typeof V3; readonly emissiveIntensity: typeof N; readonly envMapIntensity: typeof N; readonly metalness: typeof N; readonly roughness: typeof N; }, undefined>; readonly casts: v.ArraySchema<v.StrictObjectSchema<{ readonly name: typeof text; readonly file: typeof text; }, undefined>, undefined>; }, undefined> = v.strictObject({ glb: v.literal('castHook.generated.glb'), material: v.strictObject({
  color: V3, side: v.picklist([0, 1, 2]), normalScale: v.tuple([finite, finite]), emissive: V3,
  emissiveIntensity: finite, envMapIntensity: finite, metalness: finite, roughness: finite,
}), casts: v.array(v.strictObject({ name: v.string(), file: v.string() })) });
/** Admit the native hook material and exact named cast inventory at the defining schema boundary. */
export function parseCastHook(value: unknown): v.InferOutput<typeof CastHookSchema> { return v.parse(CastHookSchema, value); }

/** Validate supplied native metadata before its geometry ranges or light rows are consumed. */
export function parseNativeSignAtlas(input: unknown): NineNativeAtlas {
  const nativeFinite = v.pipe(v.number(), v.finite());
  const range = v.object({ byteOffset: v.pipe(nativeFinite, v.integer(), v.minValue(0)), byteLength: v.pipe(nativeFinite, v.integer(), v.minValue(0)) });
  const placement = v.object({ w: nativeFinite, h: nativeFinite, neon: v.boolean(), p: v.object({
    at: v.array(v.union([nativeFinite, v.string()])), normal: v.array(v.union([nativeFinite, v.string()])), size: nativeFinite,
    spec: v.object({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.string(), ink: v.exactOptional(v.string()) }),
    gain: v.exactOptional(nativeFinite), flicker: v.exactOptional(nativeFinite), blade: v.exactOptional(v.boolean()),
    board: v.exactOptional(nativeFinite), fogK: v.exactOptional(nativeFinite), clear: v.exactOptional(nativeFinite),
  }) });
  const tier = v.object({ buffer: v.string(), cells: v.record(v.string(), v.unknown()), placed: v.array(placement),
    lights: v.array(v.object({ at: v.array(nativeFinite), color: v.array(nativeFinite), w: nativeFinite, h: nativeFinite, power: nativeFinite, spill: nativeFinite })),
    keys: v.record(v.string(), v.string()), mono: v.object({ packed: v.string(), bytes: nativeFinite }), colour: v.object({ packed: v.string(), bytes: nativeFinite }),
    geometries: v.record(v.string(), v.object({ attributes: v.record(v.string(), v.object({ width: nativeFinite, data: range })),
      index: range, sphere: v.nullable(v.array(nativeFinite)) })) });
  v.assert(v.object({ phone: tier, desktop: tier }), input);
  return input;
}


/** Admit original native glyph metrics without changing property order or packed raster references. */
export function parseNativeGlyphs(input: unknown): NineNativeSignInputs['glyphs'] {
  const positive = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE));
  const uv = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1));
  const tier = v.object({ size: v.picklist([1024, 2048]), packed: v.array(v.string()), pixelHash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
    layout: v.object({ cell: positive, fontPx: positive, spread: positive, skeletonSpread: positive }),
    rects: v.record(v.string(), v.object({ u0: uv, v0: uv, u1: uv, v1: uv })) });
  v.assert(v.object({ phone: tier, desktop: tier }), input);
  return input;
}
