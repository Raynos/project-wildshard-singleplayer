import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { PracticeSceneSchema,PracticeControllerSchema } from '@wildshard/format/practiceCourseRows';
import * as v from 'valibot';
import type { GrappleRows } from '../data/grappleTypes';

const BurstFieldSchema = v.strictObject({ name: v.string(), shape: v.picklist(['flake', 'streak']), count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(24)), life: v.pipe(v.number(), v.minValue(0.001), v.maxValue(1)) });
const BurstFieldsSchema = v.strictObject({ muzzle: BurstFieldSchema, bite: BurstFieldSchema, dock: BurstFieldSchema, sparks: BurstFieldSchema });

/** Original complete admission of the four named held-tool burst fields. */
export function parseBurstFields(value: unknown): GrappleRows['bursts'] { return v.parse(BurstFieldsSchema, value); }

const finite = v.number();
const SURFACES = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand', 'water', 'grass', 'wetSand', 'planks', 'shell', 'ground', 'edge', 'earth'] as const;
const V3 = v.tuple([finite, finite, finite]);
const STYLES = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'] as const;
const Spec = v.strictObject({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.picklist(STYLES), ink: v.exactOptional(v.string()) });
export const Place = v.strictObject({
  at: V3, normal: V3, size: finite, spec: Spec, gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
  board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
});
/** Authored profile admission replaces generated JSON declaration shims. */
function profile<T extends v.ObjectEntries, P extends v.ObjectEntries>(entries: T, params: P) {
  const defaults = v.strictObject(entries);
  return v.strictObject({ defaults, variants: v.array(v.strictObject({ id: v.string(), label: v.string(), params: v.strictObject(params) })) });
}
const SignDefaultsSchema = v.strictObject({ style: v.picklist(STYLES), text: v.string(), color: v.string(), vertical: v.boolean(), size: finite,
  blade: v.boolean(), ink: v.exactOptional(v.string()), board: v.exactOptional(finite), gain: v.exactOptional(finite) });
const SignVariantSchema = v.strictObject({ id: v.string(), label: v.string(), params: v.strictObject({
  style: v.picklist(STYLES), text: v.string(), color: v.string(), vertical: v.boolean(), size: finite,
  blade: v.exactOptional(v.boolean()), ink: v.exactOptional(v.string()), board: v.exactOptional(finite), gain: v.exactOptional(finite),
}) });
const SignViewSchema = v.strictObject({ model: v.strictObject({ key: v.string(), calligraphyStyles: v.array(v.string()),
  calligraphyGain: finite, tubeGain: finite, sideways: v.array(v.string()), neonDepth: finite, bladeDepth: finite,
  depth: finite, standoff: finite, variantOf: v.record(v.string(), v.string()), pieces: v.strictObject({ atlas: v.string(), neon: v.string() }) }),
  defaults: SignDefaultsSchema, variants: v.array(SignVariantSchema) });
const GateSchema = v.strictObject({ posts: v.tuple([finite, finite, finite, finite]), s: finite, plaque: v.string(),
  couplets: v.nullable(v.tuple([v.string(), v.string()])), neonEaves: v.nullable(finite), lions: v.boolean(),
  k: v.exactOptional(finite), paint: v.exactOptional(v.picklist(['mineral', 'cinnabar'])) });
const SpecimenProfilesSchema = v.strictObject({
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
export const LayoutProjectionSchema = v.strictObject({
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



const text = v.string();
export const GeometryLibrarySchema = v.strictObject({ layout: v.array(text), boot: v.array(text), explorer: v.array(text),
  specimenBoxes: v.record(text, v.boolean()), records: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_000_000)),
  layoutDraws: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(122)) });
/** Named blob types only; this declaration adds no custom output section. */
export const SECTIONS = {};

const Offset = v.pipe(v.number(), v.integer(), v.minValue(0));
const CrowdCopy = v.strictObject({ variant: v.string(), matrix: Offset });
const Rect = v.strictObject({ x0: finite, z0: finite, x1: finite, z1: finite });
/** Matrix/color offsets index the declared float64 world buffer, never executable JSON. */
export const WorldRowsSchema = v.strictObject({
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

export const GeometryBootSchema = v.strictObject({ rows: LayoutRowsSchema, library: GeometryLibrarySchema,
  negativeZeros: v.array(v.array(text)), world: WorldRowsSchema });

const Course = v.strictObject({
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
export const FixedRowsSchema = v.strictObject({ signs: v.array(SignCall), lanterns: v.array(v.array(v.number())),
  lantern: v.strictObject({ drop: v.number(), glow: v.strictObject({ color: v.number(), w: v.number(), h: v.number(), power: v.number(), spill: v.number() }) }),
  practice: v.strictObject({ controller:PracticeControllerSchema, program: ReturnProgramSchema, sampleEpsilon:v.picklist([0,1e-9]), frame: v.pipe(v.record(v.string(), finite), v.maxEntries(115)), presentation: v.unknown(), hooks: v.pipe(v.array(v.strictObject({ pad: v.string(), x: finite, y: finite, z: finite })), v.maxLength(256)), course: Course }),
});

const N = v.number();
export const SignAtlasSchema = v.strictObject({
  glyphLayout: v.strictObject({ cell: N, fontPx: N, spread: N, skeletonSpread: N }),
  keys: v.record(v.string(), v.string()),
  pools: v.array(v.strictObject({ name: v.string(), parts: v.array(v.string()) })),
  channels: v.array(v.strictObject({ name: v.string(), source: v.string(), width: N, parts: v.exactOptional(v.array(v.string())) })),
  lights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  neonLights: v.array(v.strictObject({ at: V3, color: V3, w: N, h: N, power: N, spill: N })),
  copies: v.array(v.strictObject({ neon: v.boolean(), boxes: v.array(N), poses: v.array(v.strictObject({ x: N, y: N, z: N, yaw: N, variant: v.string(), params: v.record(v.string(), v.unknown()) })) })),
});

/** Named practice files retain the defining bounded scene contract. */
export const FixedPracticeFileSchema=v.strictObject({practice:v.strictObject({...FixedRowsSchema.entries.practice.entries,presentation:PracticeSceneSchema})});

/** Admit only the named practice payload through the same complete defining contract. */
export function parseFixedPractice(value: unknown): v.InferOutput<typeof FixedPracticeFileSchema> {
  return v.parse(FixedPracticeFileSchema, value);
}

/** Validate the course with its defining public schema before serializing it. */
export function parseFixedRows(value: unknown): Omit<v.InferOutput<typeof FixedRowsSchema>, 'practice'> & { practice: Omit<v.InferOutput<typeof FixedRowsSchema>['practice'], 'presentation'> & { presentation: v.InferOutput<typeof PracticeSceneSchema> } } {
  const row = v.parse(FixedRowsSchema, JSON.parse(JSON.stringify(value), (_key, entry: unknown) => entry === '-0' ? -0 : entry));
  return { ...row, practice: { ...row.practice, presentation: v.parse(PracticeSceneSchema, row.practice.presentation) } };
}

const HeldScalar = v.pipe(v.number(), v.finite());
const HeldIndex = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const HeldMeshSchema = v.strictObject({
  name: v.string(), look: v.string(), attributes: v.array(v.string()), channels: v.record(v.string(), v.string()),
  hull: v.boolean(), width: HeldScalar, maps: v.string(), rotation: v.pipe(v.array(HeldScalar), v.length(9)), doubleSide: v.boolean(),
});
const HeldMeshesSchema = v.pipe(v.array(HeldMeshSchema), v.minLength(1), v.maxLength(64));
const HeldRigSourceSchema = v.object({
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


const WorldHash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const WorldHeaderSchema = v.strictObject({
  version: v.literal(1), notice: v.string(),
  libraries: v.strictObject({ layout: v.array(WorldHash), boot: v.array(WorldHash), explorer: v.array(WorldHash) }),
  specimenBoxes: v.record(v.string(), v.boolean()), shardfile: v.record(v.string(), v.unknown()),
  props: v.nullable(v.record(v.string(), v.unknown())), report: v.array(v.record(v.string(), v.unknown())),
});
const WorldLayoutSchema = v.strictObject({ version: v.literal(1), count: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(4_000_000)),
  records: v.array(v.unknown()), rows: v.unknown(), bounds: v.array(v.strictObject({ sphere: v.pipe(v.array(finite), v.length(4)), box: v.pipe(v.array(finite), v.length(6)) })) });
/** Admit the owned world envelope before the defining shardfile reader validates its file and tile rows. */
export function parseWorldHeader(value: unknown): v.InferOutput<typeof WorldHeaderSchema> { return v.parse(WorldHeaderSchema, value); }
/** Preserve signed/nonfinite layout words until the existing layout admission revives them. */
export function parseWorldLayout(value: unknown): v.InferOutput<typeof WorldLayoutSchema> { return v.parse(WorldLayoutSchema, value); }
