/**
 * Material families v1 (SHARD-PLATFORM SF10a, G4 / G32): the renderer-neutral parameters. Plain data, no three.js, so the
 * shardfile's look and material entries can reference them and validate them in Node. A family is an engine-owned shader
 * (the mechanism, `toon.ts` / `pbr.ts` / `painterly.ts` / `emissive.ts`); its parameters are all a shard says about a surface.
 *
 * Two levels:
 * - **look** parameters are shared by every material of one family under one look (one shard's toon lighting); a runtime
 *   adapter (the day clock) may move them every frame, and they are uniforms, never program changes (the one exception:
 *   whether a painterly look grades at all is fixed for its life).
 * - **material** parameters belong to one surface. Only `vertexColours`, `faceted`, `doubleSided`, `alphaCutoff`, a map's
 *   presence, an emissive surface's `blend` / `tube` / `sky` and a PBR surface's `ground` layer change a program;
 *   everything else is a uniform, so a family compiles to a handful of programs.
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

/** The families v1 knows. */
export const FAMILY_IDS = ['toon', 'pbr', 'painterly', 'emissive'] as const;
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

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(v.number(), v.finite(), v.minValue(1e-3));
/** a world-space rectangle on the ground: [x0, z0, x1, z1] (metres, x0 < x1, z0 < z1) */
const rect = v.pipe(v.tuple([finite, finite, finite, finite]), v.check((r) => r[0] < r[2] && r[1] < r[3], 'rect x0 < x1 and z0 < z1'));
/** an ordered pair of non-negative numbers (a distance or angle window: from, to) */
const span = v.pipe(v.tuple([nonNegative, nonNegative]), v.check((e) => e[0] < e[1], 'span low < high'));

/**
 * The PBR family's ground layer (SF10a part 2, Signal Dunes' sand): wind ripples in two octaves, grain, broad albedo
 * drifts and streaks, an optional trail mask, and the terrain light shaping a stylised ground wants (a baked key shadow,
 * a crisp terminator, a grazing crest band, a sheen, a coloured shade fill and a light-saturation split). Every number is
 * a uniform; a runtime adapter (Signal Dunes' dusk) may move them with `updateGround`. The key is the scene's first
 * directional light. The defaults are Signal Dunes' sand at the first dusk step.
 */
export const GroundLayerSchema = v.strictObject({
  /** the wind's direction over the ground (x, z; normalised when compiled): ripples run across it */
  wind: v.optional(v.tuple([finite, finite]), [1, 0]),
  /** the ripples' and the megaripples' wavelengths (m) */
  wavelength: v.optional(v.tuple([positive, positive]), [(2 * Math.PI) / 7, (2 * Math.PI) / 3.93]),
  /** how much the coarse mottle bends the ripple crests (radians of phase) */
  lump: v.optional(nonNegative, 4.5),
  /** albedo modulation of the ripples and the megaripples */
  depth: v.optional(v.tuple([nonNegative, nonNegative]), [0.62, 0.05]),
  /** normal tilt of the ripples near and at middle distance, and of the megaripples */
  relief: v.optional(v.tuple([nonNegative, nonNegative, nonNegative]), [0.14, 0.2, 0.05]),
  /** ripple contrast near the camera and past the near window (m), and an overall strength (an adapter dims it) */
  contrast: v.optional(v.strictObject({ near: nonNegative, far: nonNegative, window: span, strength: nonNegative }), { near: 0.52, far: 0.26, window: [4, 26], strength: 1 }),
  /** distance (m) over which the ripples fade out (the far ground is smooth) */
  fade: v.optional(span, [35, 110]),
  /** slope window (normal y) where ripples stop (slip faces avalanche smooth) */
  slip: v.optional(edge, [0.8, 0.9]),
  /** slope window (normal y) counted as flat (the megaripples live there) */
  flat: v.optional(edge, [0.78, 0.96]),
  /** the ripple patches' floor (0 = bare swales between fields, 1 = rippled everywhere), the always-rippled share near the camera and its window (m) */
  patches: v.optional(v.strictObject({ floor: unit, near: unit, window: span }), { floor: 0.12, near: 0.8, window: [6, 30] }),
  /** the grain tile (R albedo, G / B bump slope), its means (subtracted: grain never shifts brightness) and a strength */
  grain: v.optional(v.strictObject({ map: v.nullable(textureRef), mean: unit, glintMean: v.pipe(v.number(), v.finite(), v.minValue(-1), v.maxValue(1)), strength: nonNegative }), { map: null, mean: 0.5, glintMean: 0, strength: 1 }),
  /** broad albedo at the dunes' scale: × low … × high by a slow noise (linear multipliers) */
  macro: v.optional(v.tuple([linear, linear]), [[0.9, 0.92, 0.96], [1.1, 1.04, 0.98]]),
  /** the albedo's overall gain (an adapter may move it) */
  albedo: v.optional(nonNegative, 0.8),
  /** pale wind streaks: tint (linear multiplier) and amount */
  streaks: v.optional(v.strictObject({ tint: linear, amount: unit }), { tint: [1.18, 1.12, 1.02], amount: 0.55 }),
  /** a trail mask (R: 1 on the trodden bed) over a ground rect: the share of ripples kept, the bed's tint and amount */
  trail: v.optional(v.nullable(v.strictObject({ map: textureRef, rect, ripples: unit, tint: linear, amount: unit })), null),
  /** a baked key-light visibility map (R) over a ground rect, its soft edge and the share of key kept in cast shade */
  keyShadow: v.optional(v.nullable(v.strictObject({ map: textureRef, rect, edge, floor: unit })), null),
  /** the key's terminator ramp on the ground's own normal (N·L): short = a crisp light / shade line */
  terminator: v.optional(v.pipe(nonNegative, v.maxValue(1)), 0.045),
  /** a brighter band where the key grazes the ground (N·L window) and its gain */
  crest: v.optional(v.strictObject({ band: edge, gain: nonNegative }), { band: [0.08, 0.22], gain: 0.9 }),
  /** a grazing-view sheen on lit faces with the key behind or beside the viewer */
  sheen: v.optional(nonNegative, 0.35),
  /** the shade fill where the key does not reach: the sky light × tint × gain + lift (linear), by amount; edge = the N·L of full key; floor = a lift everywhere */
  shade: v.optional(v.strictObject({ tint: linear, gain: nonNegative, lift: linear, amount: unit, edge: unit, floor: linear }), { tint: [0.95, 0.9, 1.3], gain: 1.05, lift: [0.016, 0.013, 0.02], amount: 0.9, edge: 0.14, floor: [0, 0, 0] }),
  /** the light-saturation split: the key's light saturated (flat ground … a face turned into the key), the sky's cooled toward a tint and kept by `keep` */
  saturation: v.optional(v.strictObject({ flat: nonNegative, facing: nonNegative, coolTint: linear, keep: unit }), { flat: 1.2, facing: 2.2, coolTint: [0.9, 0.9, 1.28], keep: 0.4 }),
  /** faces turned from a glow direction (x, z) fall dark by amount (an adapter raises it as the light goes) */
  away: v.optional(v.strictObject({ from: v.tuple([finite, finite]), amount: unit }), { from: [0, -1], amount: 0 }),
  /**
   * up to four light pools on the ground (campfires, lanterns): each adds the albedo × its colour × its strength × gain ×
   * (1 − d / radius)³ to the sky light; a pool weaker than `split` takes `low` (a lamp), from it `high` (a fire). The points
   * and strengths move every frame through `setGroundPools` (uniforms only); null = none.
   */
  pools: v.optional(v.nullable(v.strictObject({ low: linear, high: linear, split: unit, radius: positive, gain: nonNegative })), null),
});
/** A ground layer with every default filled. */
export type GroundLayerParams = v.InferOutput<typeof GroundLayerSchema>;

const metres = (max: number) => v.pipe(v.number(), v.finite(), v.minValue(1e-3), v.maxValue(max));
/**
 * The PBR family's measure layer (SHARD-PLATFORM SF56, G152): a blockout "dev map" look drawn by the shader, no texture.
 * Every surface is coloured by its role, crossed by a 1 m grid with a lighter sub-grid, and a structure or trim face of at
 * least 1 m × 1 m carries its size in metres ("4×3") in its top-left corner. The role, the face's own metres and its size
 * ride in the surface's first UV set (`measureUv`, written by a generator); a surface with no such UV (terrain, a plain
 * prop) is floor, gridded in world space on the plane its normal faces. A surface that declares the layer always draws it
 * (G163: Jake picked the dev map).
 */
export const MeasureLayerSchema = v.strictObject({
  /** sRGB: walls, structures and props (role 1) */
  structure: v.optional(srgb, [1, 0.58, 0.12]),
  /** sRGB: structural surfaces and trim (role 2) */
  trim: v.optional(srgb, [0.45, 0.45, 0.46]),
  /** sRGB: the floor (no role) */
  floor: v.optional(srgb, [0.75, 0.74, 0.71]),
  /** the 1 m lines: sRGB colour, opacity on a role surface and on the floor, half-width (m) */
  line: v.optional(v.strictObject({ colour: srgb, alpha: unit, floorAlpha: unit, width: metres(0.1) }), { colour: [1, 1, 1], alpha: 0.7, floorAlpha: 0.55, width: 0.011 }),
  /** the sub-grid: step (m, divides 1) and opacity */
  sub: v.optional(v.strictObject({ step: metres(0.5), alpha: unit }), { step: 0.25, alpha: 0.12 }),
  /** the size label: sRGB colour and glyph height (m) */
  label: v.optional(v.strictObject({ colour: srgb, height: metres(2) }), { colour: [1, 1, 1], height: 0.36 }),
  /** the share of the role colour that glows (unlit), so a face turned from the sun stays readable */
  lift: v.optional(unit, 0.4),
});
/** A measure layer with every default filled. */
export type MeasureLayerParams = v.InferOutput<typeof MeasureLayerSchema>;
/** The measure layer's surface roles: 1 = structure (orange), 2 = trim (grey). */
export type MeasureRole = 1 | 2;
/** the UV slot a measure UV packs into: role and size sit in multiples of it, the face's own metres (+1) below it */
export const MEASURE_SLOT = 64;
/**
 * The first-UV pair a measure-layer surface carries at one vertex: `role`, the vertex's metres across (`u`) and up
 * (`up`) its face from the face's bottom-left corner as seen from outside, and the face's size `w` × `h` (m). A size is labelled
 * when it is a whole or half metre up to 31.5 m (other faces are gridded, not labelled: a label never rounds); a face may span at most 62 m.
 */
export function measureUv(role: MeasureRole, u: number, up: number, w: number, h: number): [number, number] {
  if (!(w > 0 && h > 0 && w <= 62 && h <= 62 && u >= -1e-6 && up >= -1e-6 && u <= w + 1e-6 && up <= h + 1e-6)) throw new Error('measureUv: a face within 62 m, its point on it');
  const half = (d: number): number => (d <= 31.5 && Math.abs(d * 2 - Math.round(d * 2)) < 0.02 ? Math.round(d * 2) : 0);
  return [MEASURE_SLOT * (role + 4 * half(w)) + 1 + u, MEASURE_SLOT * half(h) + 1 + up];
}

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
  /** flat-shaded facets (one normal per triangle: a low-poly prop, the template's terrain); false = smooth normals */
  faceted: v.optional(v.boolean(), false),
  doubleSided: v.optional(v.boolean(), false),
  /** alpha test threshold (0 = opaque) */
  alphaCutoff: v.optional(unit, 0),
  /** a procedural ground layer (wind ripples, grain, terrain light shaping); null = a plain surface */
  ground: v.optional(v.nullable(GroundLayerSchema), null),
  /** a procedural measure layer (SF56: the dev-map look, always drawn when declared); null = none */
  measure: v.optional(v.nullable(MeasureLayerSchema), null),
});
/** A PBR material entry with every default filled. */
export type PbrMaterialParams = v.InferOutput<typeof PbrMaterialSchema>;

/**
 * The display grade a painterly look applies per pixel, in the material (no full-screen pass): a gentle filmic shoulder
 * `x(1 + x/shoulder)/(1 + x)` on gain × exposure, saturation, a cool-shadow / warm-light split by luminance and a mild
 * S-curve, then the hour's saturation on top. The defaults are Nalati Grasslands' grade.
 */
export const GradeSchema = v.strictObject({
  exposure: v.optional(v.pipe(nonNegative, v.maxValue(16)), 1),
  /** the fixed pre-gain on exposure */
  gain: v.optional(v.pipe(nonNegative, v.maxValue(16)), 1.12),
  /** the shoulder's knee (larger = a longer straight stretch before the roll-off) */
  shoulder: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.5), v.maxValue(100)), 9),
  saturation: v.optional(v.pipe(nonNegative, v.maxValue(4)), 1.05),
  /** multipliers on the shadows and on the lights (linear), blended by luminance over `split` */
  shadowTint: v.optional(linear, [0.92, 0.96, 1.05]),
  lightTint: v.optional(linear, [1.07, 0.99, 0.84]),
  split: v.optional(edge, [0.05, 0.6]),
  /** the S-curve's share (0 = none) */
  contrast: v.optional(unit, 0.35),
  /** the hour's saturation, applied last (night greys out) */
  lookSaturation: v.optional(v.pipe(nonNegative, v.maxValue(4)), 1),
});
/** A grade with every default filled. */
export type GradeParams = v.InferOutput<typeof GradeSchema>;

const DEFAULT_GRADE: GradeParams = { exposure: 1, gain: 1.12, shoulder: 9, saturation: 1.05, shadowTint: [0.92, 0.96, 1.05], lightTint: [1.07, 0.99, 0.84], split: [0.05, 0.6], contrast: 0.35, lookSaturation: 1 };

/**
 * The painterly family's look (Nalati Grasslands, style B): soft cel bands, shade painted with a sky tint, a warm
 * terminator, a painted floor that keeps dark paint off black, wetness, wind for swaying foliage, and the per-pixel grade.
 */
export const PainterlyLookSchema = v.strictObject({
  /** the colour painted into the shadow side (linear, added × albedo where the sun does not reach) */
  shade: v.optional(linear, [0.1, 0.14, 0.3]),
  /** rim light colour (linear, HDR allowed) */
  rim: v.optional(linear, [1.4, 1.2, 0.9]),
  /** the warm band just past the terminator (0 = off) */
  warm: v.optional(v.pipe(nonNegative, v.maxValue(4)), 0.8),
  /** the painted floor: dark albedo lifted toward 0.22 by the shade tint × this (0 = off) */
  floor: v.optional(v.pipe(nonNegative, v.maxValue(16)), 3),
  /** wetness 0 (dry) … 1 (soaked): darker, glossier paint on what faces the sky */
  wet: v.optional(unit, 0),
  /** world wind direction (x, z; normalised) and strength, for a material's `sway` */
  wind: v.optional(v.strictObject({ direction: v.tuple([finite, finite]), strength: nonNegative }), { direction: [0.8, 0.6], strength: 1 }),
  /** the per-pixel display grade (null = the renderer's tone mapping instead); present or null for the look's whole life */
  grade: v.optional(v.nullable(GradeSchema), DEFAULT_GRADE),
});
/** A painterly look with every default filled. */
export type PainterlyLookParams = v.InferOutput<typeof PainterlyLookSchema>;

/*
 * The painterly family's painted-terrain layer (SHARD-PLATFORM G227; the mechanism is `paintedTerrain.ts`). A painted
 * terrain is a vertex-coloured painterly ground (the vertex colour is the macro painting) with five painted tileable
 * layers on top, per pixel: the base detail (luminance-preserving), a track laid along the nearest track's direction,
 * gravel (wet below a margin height), triplanar rock and snow; three zone weights tint the ground and paint a cold ring
 * (scree, granite, snowfields, an optional ice tongue). Every world-specific number is a parameter here; the style's own
 * constants live in the shader. The per-vertex masks are the custom attributes `PAINTED_TERRAIN_ATTRIBUTES` names; the
 * baked key-light visibility and contact shade arrive as live uniforms (`bindPaintedTerrainBake`).
 */
const ptMetres = v.pipe(v.number(), v.finite(), v.minValue(0.05), v.maxValue(256));
const ptPositive = v.pipe(v.number(), v.finite(), v.minValue(1e-3));
const ptPositiveLinear = v.tuple([ptPositive, ptPositive, ptPositive]);
const ptXz = v.tuple([finite, finite]);

/** The five painted layers, in their uniform order. */
export const PAINTED_TERRAIN_LAYERS = ['base', 'track', 'gravel', 'rock', 'snow'] as const;
/** One painted layer's name. */
export type PaintedTerrainLayerName = (typeof PAINTED_TERRAIN_LAYERS)[number];

/**
 * The per-vertex inputs a painted-terrain mesh carries besides position, normal and colour (a baked tile keeps them
 * exactly; a mesh without them is filled with `fill`, plain base ground). The names are what three's GLTFLoader gives the
 * native GLB channels `_SURF` / `_RDIR` / `_ZONE` (custom semantics, lowercased):
 * - `mask` (vec4): signed metres across the nearest track (|x| ≥ 5.5 = no track; bakes write 9), gravel 0..1, snow 0..1, rock 0..1;
 * - `track` (vec2): the nearest track's unit direction (x, z), along which the track layer is laid;
 * - `zone` (vec3): the zone weights: zone A, zone B, the cold ring.
 */
export const PAINTED_TERRAIN_ATTRIBUTES = {
  mask: { name: '_surf', size: 4, fill: [9, 0, 0, 0] },
  track: { name: '_rdir', size: 2, fill: [1, 0] },
  zone: { name: '_zone', size: 3, fill: [0, 0, 0] },
} as const;

const zoneTint = v.strictObject({ tint: linear, amount: unit });

/** The painted-terrain layer of a painterly surface. */
export const PaintedTerrainSchema = v.strictObject({
  /** the five painted tileable textures (sRGB colour), by layer */
  maps: v.strictObject({ base: textureRef, track: textureRef, gravel: textureRef, rock: textureRef, snow: textureRef }),
  /** the metres one repeat of each texture spans on the ground */
  metres: v.strictObject({ base: ptMetres, track: ptMetres, gravel: ptMetres, rock: ptMetres, snow: ptMetres }),
  /** the base and rock textures' mean colours (linear, after the sRGB decode): detail divides by them, so it never shifts brightness */
  means: v.strictObject({ base: ptPositiveLinear, rock: ptPositiveLinear }),
  /** the snow line (m): the cold ring's flatter facets catch snow from 10 m below it; `high` is the height window over which the peaks go white and ribbed */
  snow: v.strictObject({ line: finite, high: v.pipe(ptXz, v.check((h) => h[0] < h[1], 'snow high low < high')) }),
  /** the gravel's wet margin: wet from the first height down to fully wet at the second (m) */
  wet: v.pipe(ptXz, v.check((w) => w[0] > w[1], 'wet margin runs downward')),
  /** an ice tongue in the cold ring, flowing from `from` to `to` (x, z), `half` metres either side of its line; null = none */
  ice: v.optional(v.nullable(v.strictObject({ from: ptXz, to: ptXz, half: v.pipe(v.number(), v.finite(), v.minValue(1)) })), null),
  /** the zone A and zone B tints (linear multipliers) and how much of each a full zone weight takes */
  zones: v.optional(v.strictObject({ a: zoneTint, b: zoneTint }), { a: { tint: [0.86, 1.1, 0.8], amount: 0.55 }, b: { tint: [1.2, 1.02, 0.6], amount: 0.65 } }),
  /** where the key light on the ground is shadowed by the baked visibility (the static casters left out of the realtime map): on phones, always or never */
  bakeKeyLight: v.optional(v.picklist(['phone', 'always', 'never']), 'phone'),
});
/** A painted-terrain layer with every default filled. */
export type PaintedTerrainParams = v.InferOutput<typeof PaintedTerrainSchema>;

/** Validate a painted-terrain layer and fill its defaults; throws a readable error on bad data. */
export function parsePaintedTerrain(input: unknown): PaintedTerrainParams {
  const r = v.safeParse(PaintedTerrainSchema, input);
  if (!r.success) throw new Error(`painted terrain: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** The painted layer's five texture references, in layer order. */
export function paintedTerrainTextureRefs(params: PaintedTerrainParams): string[] {
  return PAINTED_TERRAIN_LAYERS.map((layer) => params.maps[layer]);
}

/** One painterly surface: vertex-coloured, no specular, a per-surface rim, cel strength, shade share and sway. */
export const PainterlyMaterialSchema = v.strictObject({
  family: v.literal('painterly'),
  /** sRGB, multiplies the vertex colours (and the map) */
  colour: v.optional(srgb, [1, 1, 1]),
  /** rim-light strength (0 = none … 1 = strong) */
  rim: v.optional(unit, 0.35),
  /** cel strength (0 = plain Lambert … 1 = the full three-band ramp) */
  bands: v.optional(unit, 0.8),
  /** how much of the painted shade tint this surface takes */
  shade: v.optional(unit, 1),
  /** this surface's share of the painted floor */
  floor: v.optional(unit, 1),
  /** wind sway in metres per (local metre above the origin)² (foliage, flags; 0 = rigid) */
  sway: v.optional(v.pipe(nonNegative, v.maxValue(1)), 0),
  /** self-light colour (sRGB) and its strength: a lantern, embers, eyes */
  emissive: v.optional(srgb, [0, 0, 0]),
  emissiveIntensity: v.optional(v.pipe(nonNegative, v.maxValue(64)), 1),
  /** a base-colour texture (sRGB) × colour × vertex colours */
  map: v.optional(v.nullable(textureRef), null),
  vertexColours: v.optional(v.boolean(), true),
  doubleSided: v.optional(v.boolean(), false),
  /** alpha test threshold (0 = opaque) */
  alphaCutoff: v.optional(unit, 0),
  /** a painted-terrain layer (G227: five painted tileable layers over the vertex-coloured macro painting, `PaintedTerrainSchema` above); absent = a plain surface */
  terrain: v.exactOptional(PaintedTerrainSchema),
});
/** A painterly material entry with every default filled. */
export type PainterlyMaterialParams = v.InferOutput<typeof PainterlyMaterialSchema>;

/** The emissive family's look: one gain over every emitter (exposure by the hour) and the stage blend a sky reads. */
export const EmissiveLookSchema = v.strictObject({
  /** multiplies every emitter under this look */
  gain: v.optional(v.pipe(nonNegative, v.maxValue(64)), 1),
  /** 0 … 1: a sky's blend from its first map to its second (a runtime adapter feeds it: Signal Dunes' dusk) */
  blend: v.optional(unit, 0),
});
/** An emissive look with every default filled. */
export type EmissiveLookParams = v.InferOutput<typeof EmissiveLookSchema>;

/**
 * A neon tube drawn from a distance field (R: the glyph's fill, 0.5 on its edge; G: the distance to its skeleton): a
 * whitened core, a darker glass rim, an optional seam and a short halo, all in em (the field's cell height = 1).
 */
export const NeonTubeSchema = v.strictObject({
  field: textureRef,
  /** em of fill distance one unit of R spans either side of 0.5, and em per unit of G */
  fillSpread: positive,
  skeletonSpread: positive,
  /** 0 = brush fill … 1 = monoline tube round the skeleton */
  mono: v.optional(unit, 0),
  radius: v.optional(nonNegative, 0.05),
  rim: v.optional(nonNegative, 0.024),
  thicken: v.optional(v.pipe(v.number(), v.finite(), v.minValue(-1), v.maxValue(1)), 0.022),
  seam: v.optional(unit, 0),
  seamWidth: v.optional(nonNegative, 0.008),
  haloReach: v.optional(nonNegative, 0.12),
  haloGain: v.optional(nonNegative, 0.22),
  /** how far the core whitens (0 = the tint) and how dark the rim's glass is (× tint) */
  core: v.optional(unit, 0.5),
  rimShade: v.optional(unit, 0.62),
  /** the uv size of one field cell (an atlas laid out on a grid from 0): the halo fades out at each cell's border, so a glyph quad never cuts it hard; null = no fade */
  cell: v.optional(v.nullable(v.tuple([v.pipe(positive, v.maxValue(1)), v.pipe(positive, v.maxValue(1))])), null),
});

/**
 * A sky dome at infinity from one or two seamless 360° panorama strips (x = heading clockwise from -z, the strip spanning
 * `elevation` degrees), blended by the look's `blend`; under `hold` degrees the colour is averaged round the heading (the
 * 3-D horizon owns the silhouette); over the top it eases into the strip's top row; crisp stars where the sky is dark.
 */
export const SkyDomeSchema = v.strictObject({
  maps: v.tuple([textureRef, v.nullable(textureRef)]),
  /** the strip's bottom and top elevation (degrees) */
  elevation: v.optional(v.pipe(v.tuple([v.pipe(finite, v.minValue(-90)), v.pipe(finite, v.maxValue(90))]), v.check((e) => e[0] < e[1], 'elevation low < high')), [-8, 45]),
  /** the blend window over the look's `blend` (the first map up to low, the second from high) */
  window: v.optional(edge, [0, 1]),
  /** gain on the first map low in the sky and from 30° up (a re-coloured early stage) */
  firstGain: v.optional(v.tuple([nonNegative, nonNegative]), [1, 1]),
  /** degrees under which the sky holds and averages round the heading */
  hold: v.optional(v.pipe(nonNegative, v.maxValue(30)), 2.5),
  /** stars: density (share of cells lit), gain, the elevation window (degrees) they fade in over, the blend window they appear over */
  stars: v.optional(v.strictObject({ density: unit, gain: nonNegative, elevation: span, appear: edge }), { density: 0.0045, gain: 0.5, elevation: [8, 20], appear: [0.45, 0.7] }),
  /** ± dither added (linear), so a dark gradient never bands */
  dither: v.optional(v.pipe(nonNegative, v.maxValue(0.1)), 0.004),
});

/**
 * One emissive surface: unlit light. `colour` × `intensity` (HDR) × the vertex colours × an optional map, flickering by a
 * seed, fogged at a share of the fog. With `tube` it draws a neon glyph from a distance field; with `sky`, a sky dome.
 */
export const EmissiveMaterialSchema = v.strictObject({
  family: v.literal('emissive'),
  /** sRGB tint */
  colour: v.optional(srgb, [1, 1, 1]),
  /** linear gain (neon runs at ~4) */
  intensity: v.optional(v.pipe(nonNegative, v.maxValue(64)), 1),
  vertexColours: v.optional(v.boolean(), false),
  /** an sRGB colour map × tint */
  map: v.optional(v.nullable(textureRef), null),
  /** 'additive' adds light over what is behind it (no depth write); 'opaque' is a surface lit from within */
  blend: v.optional(v.picklist(['opaque', 'additive']), 'opaque'),
  doubleSided: v.optional(v.boolean(), false),
  /** how much of the fog it takes: transmittance ^ fog (0 = cuts through, 1 = fogged like any surface) */
  fog: v.optional(unit, 1),
  /** 0 = steady; else the seed of a stuttering tube (dark for a few beats now and then) */
  flicker: v.optional(v.pipe(nonNegative, v.maxValue(1000)), 0),
  tube: v.optional(v.nullable(NeonTubeSchema), null),
  sky: v.optional(v.nullable(SkyDomeSchema), null),
});
/** An emissive material entry with every default filled. */
export type EmissiveMaterialParams = v.InferOutput<typeof EmissiveMaterialSchema>;

/** Any family's material entry, discriminated by `family` (an emissive surface is a tube or a sky, never both). */
export const FamilyMaterialSchema = v.pipe(
  v.variant('family', [ToonMaterialSchema, PbrMaterialSchema, PainterlyMaterialSchema, EmissiveMaterialSchema]),
  v.check((m) => m.family !== 'emissive' || m.tube === null || m.sky === null, 'an emissive surface is a tube or a sky, not both'),
);
/** Any family's validated material entry (what a compiler receives). */
export type FamilyMaterialParams = v.InferOutput<typeof FamilyMaterialSchema>;
/** What an author or a build writes: omitted fields take the family's defaults. */
export type FamilyMaterialInput = v.InferInput<typeof FamilyMaterialSchema>;

/** the preset reference version a material names (`{ family: "graph", preset, version }`); another version is refused */
export const GRAPH_PRESET_VERSION = 1;
/**
 * Why a family entry has no built-in graph preset (SF59), or null when it has one: the one rule admission and the
 * engine's preset door (`graph/presets.ts` `familyPresetGraph`) share. IR version 1 cannot express a PBR surface other than
 * the measure layer alone (maps or a ground layer), a painted terrain, an emissive sky, an additive blend or a fog share
 * other than 1.
 */
export function presetRefusal(entry: FamilyMaterialParams): string | null {
  if (entry.family === 'painterly' && entry.terrain !== undefined) return 'painterly preset: a painted terrain is not expressible in IR version 1';
  if (entry.family === 'pbr' && (entry.measure === null || entry.ground !== null || entry.maps.colour !== null || entry.maps.normal !== null || entry.maps.orm !== null)) return 'pbr preset: IR version 1 expresses the measure layer alone (no maps, no ground layer)';
  if (entry.family === 'emissive') {
    const missing: string[] = [];
    if (entry.sky !== null) missing.push('a sky (atan / asin, a screen-position input, back-face depth-off unfogged render state)');
    if (entry.blend === 'additive') missing.push('an additive blend (no blend mode)');
    if (entry.fog !== 1) missing.push(`a fog share of ${entry.fog} (the fog epilogue is not a stage)`);
    if (missing.length > 0) return `emissive preset: IR version 1 cannot express ${missing.join('; ')}`;
  }
  return null;
}

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

/** Validate the painterly look and fill its defaults. */
export function parsePainterlyLook(input: unknown): PainterlyLookParams {
  const r = v.safeParse(PainterlyLookSchema, input);
  if (!r.success) throw new Error(`painterly look: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** Validate the emissive look and fill its defaults. */
export function parseEmissiveLook(input: unknown): EmissiveLookParams {
  const r = v.safeParse(EmissiveLookSchema, input);
  if (!r.success) throw new Error(`emissive look: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}

/** Validate a ground layer and fill its defaults. */
export function parseGroundLayer(input: unknown): GroundLayerParams {
  const r = v.safeParse(GroundLayerSchema, input);
  if (!r.success) throw new Error(`ground layer: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  return r.output;
}
