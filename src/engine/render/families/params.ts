/**
 * Material families v1 (SHARD-PLATFORM SF10a, G4 / G32): the renderer-neutral parameters. Plain data, no three.js, so the
 * shardfile's look and material entries can reference them and validate them in Node. A family is an engine-owned shader
 * (the mechanism, `toon.ts` / `pbr.ts`); its parameters are all a shard says about a surface.
 *
 * Two levels:
 * - **look** parameters are shared by every material of one family under one look (one shard's toon lighting); a runtime
 *   adapter (the day clock) may move them every frame, and they are uniforms, never program changes.
 * - **material** parameters belong to one surface. Only `vertexColours`, `faceted`, `doubleSided` and `alphaCutoff`
 *   change a program; everything else is a uniform, so a family compiles to a handful of programs.
 *
 * Colour conventions: `colour` is sRGB in [0, 1] (what an artist picks); light terms (`lift`, `rim`, `terminator`) are
 * linear and may exceed 1. Texture references are opaque strings (a shardfile file hash, `commons:<hash>`, or an asset
 * path during the transition) resolved by the caller; textures follow glTF's UV convention (no vertical flip).
 */
import * as v from 'valibot';

const unit = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1));
const nonNegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const srgb = v.tuple([unit, unit, unit]);
const linear = v.tuple([nonNegative, nonNegative, nonNegative]);
/** an ordered [low, high] smoothstep edge pair in [0, 1] */
const edge = v.pipe(v.tuple([unit, unit]), v.check((e) => e[0] < e[1], 'edge low < high'));
const textureRef = v.pipe(v.string(), v.minLength(1), v.maxLength(256));

/** The families v1 knows. Part 2 of SF10a adds `painterly` and `emissive`. */
export const FAMILY_IDS = ['toon', 'pbr'] as const;
/** A family id a material entry names. */
export type FamilyId = (typeof FAMILY_IDS)[number];

/** An sRGB or linear colour as three numbers. */
export type Rgb = readonly [number, number, number];

/**
 * The toon family's look: a two-band ramp with coloured shade, a terminator band and a banded rim, plus the environment
 * inputs (drifting cloud shade, caustics under a water level) a runtime adapter feeds.
 */
export const ToonLookSchema = v.strictObject({
  /** N·L edge of the lit band (a facet is lit or in shade) */
  faceEdge: v.optional(edge, [0.14, 0.2]),
  /** cast-shadow edge (soft, so a dithered penumbra does not speckle) */
  shadowEdge: v.optional(edge, [0.25, 0.75]),
  /** how much of N·L the lit band keeps (0 = flat toon, 0.2 = a faint facet grade) */
  litGrade: v.optional(unit, 0.2),
  /** how much of the sun's facet grade the shade band keeps (0 = flat shade) */
  shadeGrade: v.optional(unit, 0),
  /** added to the shade band (linear × albedo): shadow is coloured, never black */
  lift: v.optional(linear, [0.07, 0.035, 0.2]),
  /** rim colour × strength (linear), on the lit side of vertical-ish faces */
  rim: v.optional(linear, [1.3, 0.95, 0.6]),
  /** terminator band colour × strength (linear), where a facet turns from the sun */
  terminator: v.optional(linear, [0.4, 0.16, 0.06]),
  /** surfaces rougher than this get no sun specular (a Lambert, not a GGX, on the phone) */
  glossBelow: v.optional(unit, 0.72),
  /** drifting cloud shade over the lit band: strength 0..1 (0 = off), feature size (m), wind (m/s, xz) */
  cloudShade: v.optional(v.strictObject({ strength: unit, scale: v.pipe(v.number(), v.finite(), v.minValue(1)), wind: v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]) }), { strength: 0.6, scale: 60, wind: [3.2, 1.4] }),
  /** sunlight caustics under a water level: level (m; null = no water) and strength */
  caustics: v.optional(v.strictObject({ level: v.nullable(v.pipe(v.number(), v.finite())), strength: nonNegative }), { level: null, strength: 0.5 }),
});
/** A toon look with every default filled. */
export type ToonLookParams = v.InferOutput<typeof ToonLookSchema>;

/** One toon surface: flat-shaded, vertex-coloured facets by default (no textures). */
export const ToonMaterialSchema = v.strictObject({
  family: v.literal('toon'),
  /** sRGB, multiplies the vertex colours */
  colour: v.optional(srgb, [1, 1, 1]),
  vertexColours: v.optional(v.boolean(), true),
  /** flat-shaded facets (one normal per triangle) */
  faceted: v.optional(v.boolean(), true),
  doubleSided: v.optional(v.boolean(), true),
  roughness: v.optional(unit, 0.88),
  metalness: v.optional(unit, 0),
});
/** A toon material entry with every default filled. */
export type ToonMaterialParams = v.InferOutput<typeof ToonMaterialSchema>;

/** One PBR surface: metal / rough with colour, normal and packed ORM maps (occlusion r, roughness g, metalness b). */
export const PbrMaterialSchema = v.strictObject({
  family: v.literal('pbr'),
  /** sRGB, multiplies the colour map */
  colour: v.optional(srgb, [1, 1, 1]),
  /** multiplies the ORM map's roughness */
  roughness: v.optional(unit, 1),
  /** multiplies the ORM map's metalness */
  metalness: v.optional(unit, 1),
  maps: v.optional(v.strictObject({ colour: v.nullable(textureRef), normal: v.nullable(textureRef), orm: v.nullable(textureRef) }), { colour: null, normal: null, orm: null }),
  normalScale: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(4)), 1),
  /** how much of the ORM map's occlusion applies (0 = none) */
  occlusion: v.optional(unit, 1),
  /** image-based light strength */
  envStrength: v.optional(v.pipe(nonNegative, v.maxValue(8)), 1),
  vertexColours: v.optional(v.boolean(), false),
  doubleSided: v.optional(v.boolean(), false),
  /** alpha test threshold (0 = opaque) */
  alphaCutoff: v.optional(unit, 0),
});
/** A PBR material entry with every default filled. */
export type PbrMaterialParams = v.InferOutput<typeof PbrMaterialSchema>;

/** Any family's material entry, discriminated by `family`. */
export const FamilyMaterialSchema = v.variant('family', [ToonMaterialSchema, PbrMaterialSchema]);
/** Any family's validated material entry (what a compiler receives). */
export type FamilyMaterialParams = v.InferOutput<typeof FamilyMaterialSchema>;
/** What an author or a build writes: omitted fields take the family's defaults. */
export type FamilyMaterialInput = v.InferInput<typeof FamilyMaterialSchema>;

/** Validate a material entry and fill the family's defaults; throws a readable error on bad data. */
export function parseFamilyMaterial(input: unknown): FamilyMaterialParams {
  const r = v.safeParse(FamilyMaterialSchema, input);
  if (!r.success) throw new Error(`material family: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** Validate the toon look and fill its defaults. */
export function parseToonLook(input: unknown): ToonLookParams {
  const r = v.safeParse(ToonLookSchema, input);
  if (!r.success) throw new Error(`toon look: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}
