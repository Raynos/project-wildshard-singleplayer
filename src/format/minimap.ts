import * as v from 'valibot';

/**
 * The minimap's pure row contracts (DS1.1): a named place on the maps, as a level's map palette declares it (the
 * minimap's labels, the full map's pins), and a whole map palette as declared rows (SHARD-PLATFORM M3). The engine's
 * `@wildshard/engine/ui/Minimap` draws them; a shard's `data/` rows declare them and `mapPalette` turns them into the
 * manifest's `minimap.palette` (the ground colour at a sample, the overlay painted over it, the named places). Node-safe
 * and import-free: a manifest and a bake can read it. Nothing here knows a shard.
 *
 * - The ground starts at `base` and mixes each layer's colour over the colour so far, in order, by the weight of one
 *   field: the smoothstep of the field between the layer's `edges`, or the field itself when it has none; flipped by
 *   `invert` and scaled by `gain`. The fields: `height` in metres, `slope`, the distance from a centre when `centre` is set
 *   and the sample lies inside its `within`, or a `wave` (0–1). A layer's colour may itself be a paint (a base and its own
 *   layers), worked out at the sample and then mixed in.
 * - The overlay draws, in order: every segment's strokes (round caps and joins, each with its own dash or none), the
 *   level's trails once per trail stroke, then the marks.
 * - Widths, sizes and dashes are metres (scaled by the map's pixels per metre).
 */

/** a named place on the maps (the minimap's labels, the full map's pins) */
export interface MapPoi { x: number; z: number; label: string; color: string }

/** An sRGB colour, 0–255 per channel. */
export type MapRgb = readonly [number, number, number];

/** A banded wave over the ground, 0–1: 0.5 + 0.5 sin(x kx + z kz + sin(z warp[0]) warp[1]). */
export interface MapWave {
  readonly kx: number;
  readonly kz: number;
  /** the bands' wobble along z: its frequency and its amplitude (radians) */
  readonly warp?: readonly [number, number];
}

/** A colour worked out at the sample: `base` with `layers` mixed over it. */
export interface MapGroundPaint { readonly base: MapRgb; readonly layers: readonly MapGroundLayer[] }

/** One layer of the ground paint: `color` mixed over the colour so far by a field's weight. */
export interface MapGroundLayer {
  readonly color: MapRgb | MapGroundPaint;
  /** the field: the sample's height or slope, (with `centre`) its distance from the centre, or (with `wave`) a wave */
  readonly by: 'height' | 'slope' | 'distance' | 'wave';
  /** the smoothstep's edges; unset, the field itself is the weight */
  readonly edges?: readonly [number, number];
  /** the weight's scale (default 1) */
  readonly gain?: number;
  /** the weight is 1 − the smoothstep (nearer the low edge, more of the colour) */
  readonly invert?: boolean;
  /** for `by: 'distance'`: the centre (x, z, metres) and the radius past which the layer paints nothing */
  readonly centre?: { readonly x: number; readonly z: number; readonly within: number };
  /** for `by: 'wave'` */
  readonly wave?: MapWave;
}

/** One stroke of a segment or a trail: its width (metres), its CSS style and its dash (metres; none when unset). */
export interface MapStroke {
  readonly width: number;
  readonly style: string;
  readonly dash?: readonly [number, number];
}

/** A straight mark from `from` to `to` (x, z), painted with each stroke in order. */
export interface MapSegment {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly strokes: readonly MapStroke[];
}

/** A place's mark: a square (`half` its half-side), a turned box, a ring or a dot (sizes in metres). */
export type MapMark =
  | { readonly kind: 'square'; readonly x: number; readonly z: number; readonly half: number; readonly fill: string }
  | { readonly kind: 'box'; readonly x: number; readonly z: number; readonly yaw: number; readonly width: number; readonly length: number; readonly fill: string }
  | { readonly kind: 'ring'; readonly x: number; readonly z: number; readonly r: number; readonly line: number; readonly stroke: string }
  | { readonly kind: 'dot'; readonly x: number; readonly z: number; readonly r: number; readonly fill: string };

/** A level's whole map look as data. */
export interface MapPaletteRow {
  readonly ground: MapGroundPaint;
  readonly segments: readonly MapSegment[];
  readonly trails: readonly MapStroke[];
  readonly marks: readonly MapMark[];
  /** the named places: the full map's pins */
  readonly pois: readonly Readonly<MapPoi>[];
}

/** The canvas calls an overlay makes (a `CanvasRenderingContext2D` is one; the format project has no DOM types). */
export interface MapCanvas {
  lineCap: string; lineJoin: string; lineWidth: number; strokeStyle: unknown; fillStyle: unknown;
  setLineDash: (segments: number[]) => void; beginPath: () => void; moveTo: (x: number, y: number) => void; lineTo: (x: number, y: number) => void;
  stroke: () => void; fill: () => void; arc: (x: number, y: number, r: number, start: number, end: number) => void;
  fillRect: (x: number, y: number, w: number, h: number) => void; save: () => void; restore: () => void;
  translate: (x: number, y: number) => void; rotate: (angle: number) => void;
}
/** What an overlay paints with: the context, world → layer px, px per metre, the level's trails (the engine's `MapOverlay`). */
export interface MapPaletteOverlay {
  readonly ctx: MapCanvas; readonly toU: (x: number) => number; readonly toV: (z: number) => number; readonly ppm: number;
  readonly trails: readonly (readonly (readonly [number, number])[])[];
}
/** The palette the rows make (the engine's `MinimapPalette`). */
export interface MapPaletteLook {
  ground: (x: number, z: number, h: number, slope: number, forest: number, out: [number, number, number]) => void;
  overlay: (o: MapPaletteOverlay) => void;
  pois: () => MapPoi[];
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** `out` = `a` + (`b` − `a`) × `t`, per channel. */
function mix(a: MapRgb, b: MapRgb, t: number, out: [number, number, number]): void {
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
}

/** The layer's field at a sample, or null where it paints nothing (outside its centre's radius). */
function field(layer: MapGroundLayer, x: number, z: number, h: number, slope: number): number | null {
  if (layer.by === 'height') return h;
  if (layer.by === 'slope') return slope;
  if (layer.by === 'wave') {
    const w = layer.wave;
    if (w === undefined) return null;
    return 0.5 + 0.5 * Math.sin(x * w.kx + z * w.kz + (w.warp === undefined ? 0 : Math.sin(z * w.warp[0]) * w.warp[1]));
  }
  const c = layer.centre;
  if (c === undefined) return null;
  const d = Math.hypot(x - c.x, z - c.z);
  return d < c.within ? d : null;
}

/** The layer's weight at a sample, or null where it paints nothing. */
function weight(layer: MapGroundLayer, x: number, z: number, h: number, slope: number): number | null {
  const f = field(layer, x, z, h, slope);
  if (f === null) return null;
  const s = layer.edges === undefined ? f : smooth(layer.edges[0], layer.edges[1], f), t = layer.invert === true ? 1 - s : s;
  return layer.gain === undefined ? t : t * layer.gain;
}

/** Paints `paint` at a sample into `out`. */
function paintAt(paint: MapGroundPaint, x: number, z: number, h: number, slope: number, out: [number, number, number]): void {
  out[0] = paint.base[0]; out[1] = paint.base[1]; out[2] = paint.base[2];
  for (const layer of paint.layers) {
    const t = weight(layer, x, z, h, slope);
    if (t === null) continue;
    const c = layer.color;
    if ('base' in c) { const inner: [number, number, number] = [0, 0, 0]; paintAt(c, x, z, h, slope, inner); mix(out, inner, t, out); }
    else mix(out, c, t, out);
  }
}

/** Paints one mark. */
function mark(m: MapMark, { ctx, toU, toV, ppm }: MapPaletteOverlay): void {
  if (m.kind === 'square') { ctx.fillStyle = m.fill; ctx.fillRect(toU(m.x) - m.half * ppm, toV(m.z) - m.half * ppm, 2 * m.half * ppm, 2 * m.half * ppm); return; }
  if (m.kind === 'box') {
    ctx.save(); ctx.translate(toU(m.x), toV(m.z)); ctx.rotate(-m.yaw); ctx.fillStyle = m.fill;
    ctx.fillRect(-(m.width / 2) * ppm, -(m.length / 2) * ppm, m.width * ppm, m.length * ppm); ctx.restore(); return;
  }
  if (m.kind === 'ring') { ctx.lineWidth = m.line * ppm; ctx.strokeStyle = m.stroke; ctx.beginPath(); ctx.arc(toU(m.x), toV(m.z), m.r * ppm, 0, Math.PI * 2); ctx.stroke(); return; }
  ctx.fillStyle = m.fill; ctx.beginPath(); ctx.arc(toU(m.x), toV(m.z), m.r * ppm, 0, Math.PI * 2); ctx.fill();
}

/** A stroke's dash in px (none when unset). */
const dashOf = (k: MapStroke, ppm: number): number[] => (k.dash === undefined ? [] : [k.dash[0] * ppm, k.dash[1] * ppm]);

/** A level's `minimap.palette` from its rows: the layered ground, the overlay's strokes and marks, the named places. */
export function mapPalette(row: MapPaletteRow): MapPaletteLook {
  const ground = (x: number, z: number, h: number, slope: number, _forest: number, out: [number, number, number]): void => paintAt(row.ground, x, z, h, slope, out);
  const overlay = (o: MapPaletteOverlay): void => {
    const { ctx, toU, toV, ppm, trails } = o;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of row.segments) for (const k of s.strokes) {
      ctx.lineWidth = k.width * ppm; ctx.strokeStyle = k.style; ctx.setLineDash(dashOf(k, ppm)); ctx.beginPath();
      ctx.moveTo(toU(s.from[0]), toV(s.from[1])); ctx.lineTo(toU(s.to[0]), toV(s.to[1])); ctx.stroke();
    }
    for (const k of row.trails) {
      ctx.lineWidth = k.width * ppm; ctx.strokeStyle = k.style; ctx.setLineDash(dashOf(k, ppm)); ctx.beginPath();
      for (const poly of trails) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const m of row.marks) mark(m, o);
  };
  const pois = (): MapPoi[] => row.pois.map((p) => ({ x: p.x, z: p.z, label: p.label, color: p.color }));
  return { ground, overlay, pois };
}

/** Authored discovery metadata. Source image paths are resolved by generated
 * discovery imports; shardfile presentation hashes retain their own contract. */
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const number = v.pipe(v.number(), v.minValue(-1e9), v.maxValue(1e9));
const rgb = v.tuple([number, number, number]);
const image = v.pipe(v.string(), v.maxLength(16384), v.regex(/^(?:\/src\/|\/assets\/|data:image\/|\/shardfiles\/(?:_[a-z]+|[a-z][a-z0-9-]*)\/blobs\/image\/[a-f0-9]{64}\.(?:webp|jpg|png)$)/u));
const art = v.strictObject({ world: image, models: image, sets: image, practice: image });
const band = v.strictObject({ azimuth: number, spread: number, height: number, rough: number });
const ring = v.strictObject({ r: number, base: number, color: rgb, top: rgb, snowLine: number, haze: number,
  bands: v.pipe(v.array(band), v.maxLength(128)), floor: number });
/** JSON metadata shared by discovery and the shardfile schema. Native loaders,
 * generated inventories and terrain/model owners are explicit typed bindings. */
const localModule = v.pipe(text, v.regex(/^\.\/[a-zA-Z0-9_-]+(?:[./][a-zA-Z0-9_-]+)*$/u));
/** Authored discovery selects data or declared generated modules, never source loaders. */
const bindingModule = v.pipe(localModule, v.regex(/\.(?:json|generated)$/u));
const bindingName = v.pipe(text, v.regex(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/u));
const binding: v.StrictObjectSchema<{ readonly module: v.GenericSchema<ManifestBindingRowsInput['module'], ManifestBindingRows['module']>; readonly export: v.GenericSchema<ManifestBindingRowsInput['export'], ManifestBindingRows['export']>; }, undefined> = v.strictObject({module: bindingModule, export: bindingName});
// A source program supplies these values in its admitted product receipt.
// This is a data marker, never permission to import an executable generator.
const programBinding = v.strictObject({ program: v.literal(true) });
const dataBinding = v.union([binding, programBinding]);
const moduleBinding = v.strictObject({module: bindingModule});
/** G4: rows a shard generates for the game to build from (`declaredGround`, `declaredForestQueries`, `declaredStreamClip`) */
const declared = v.strictObject({ platform: v.literal('declared'), rows: binding });
const pageBoot = v.strictObject({ platform: v.literal('page-mode'), rows: v.union([v.strictObject({
  module: v.pipe(binding.entries.module, v.regex(/\.json$/u)), export: v.literal('default'),
}), programBinding]) });
/** A constant density field; no executable forest recipe or species policy. */
export const FixedForestQueriesSchema: v.GenericSchema<FixedForestQueriesRowsInput, FixedForestQueriesRows> = v.strictObject({ platform: v.literal('fixed'), density: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) });
const bindings = v.strictObject({
  accent: text, budgets: dataBinding, runtimeCost: v.exactOptional(binding), navigation: v.exactOptional(dataBinding),
  // Finite sample declarations hydrate through defineShard in its original decode order.
  groundRows: v.exactOptional(binding), groundColourSamples: v.exactOptional(binding), surfaceSamples: v.exactOptional(binding),
  forestMaskSamples: v.exactOptional(binding), mapGroundSamples: v.exactOptional(binding), navmesh: v.exactOptional(binding),
  mapPalette: v.exactOptional(dataBinding), poses: v.exactOptional(dataBinding), audioCues: v.exactOptional(dataBinding),
  boot: v.exactOptional(v.union([pageBoot, v.strictObject({files: dataBinding, sources: dataBinding, lateReads: v.exactOptional(dataBinding), bakedUnread: v.exactOptional(binding), audio: v.exactOptional(binding), explore: v.exactOptional(v.union([programBinding, v.strictObject({ module: v.pipe(bindingModule, v.regex(/\.json$/u)), export: v.literal('default') })]))})])),
  forestQueries: v.exactOptional(v.union([binding, declared, FixedForestQueriesSchema])),
  pondClip: v.exactOptional(v.union([binding, declared])), sword: v.exactOptional(v.union([binding, v.strictObject({ rows: bindingModule }), v.strictObject({ platform: v.literal('graph'), file: text })])), audioPreload: v.exactOptional(binding),
  posesLoader: v.exactOptional(binding), spawns: v.exactOptional(binding),
  entry: v.exactOptional(v.strictObject({ platform: v.literal('client-plan'), retainHomeRuntime: v.boolean(), stagesOwner: v.picklist(['declared', 'runtime']),
    styles: v.exactOptional(v.pipe(v.array(v.pipe(localModule, v.regex(/\.css$/u))), v.maxLength(8),
      v.check(rows => new Set(rows).size === rows.length, 'Unique entry styles'))) })),
  ground: v.exactOptional(v.union([binding, declared])), render: v.exactOptional(v.union([binding, v.strictObject({ platform: v.picklist(['painted', 'toon']) }),
    // G571: a keyed day / night sky look from rows (game looks/keyedSky `keyedSkyRender`): its channel set, dome / env
    // looks and the page-mode trim row (packed keys and the small environment) of a page policy file
    v.strictObject({ platform: v.literal('keyed'), channels: text, looks: binding, trim: binding, trimRow: bindingName }),
    // G599: a post-graph look read from a product file's row (game looks/postGraphLook `postGraphLook`): the file and the
    // field path to its row
    v.strictObject({ platform: v.literal('post'), file: text, field: v.pipe(v.array(text), v.maxLength(8)) })])), load: v.exactOptional(moduleBinding),
  ktx2: v.exactOptional(v.union([pageBoot, moduleBinding, binding, programBinding])), roster: v.exactOptional(v.union([v.strictObject({...binding.entries, call: v.boolean()}),
    // G601 C10: held arms' Explorer cards from a data file (game models/heldGear `heldArmsGear`)
    v.strictObject({ platform: v.literal('held'), rows: bindingModule })])),
});
const tier = v.objectWithRest({aa: v.exactOptional(v.picklist(['fxaa', 'smaa', 'off'])),
  slices: v.exactOptional(v.boolean()), skipRaysOffscreen: v.exactOptional(v.boolean()), envSteps: v.exactOptional(v.boolean()), pointLightSkip: v.exactOptional(v.boolean()), godRays: v.exactOptional(v.boolean()), ao: v.exactOptional(v.boolean()),
  textures: v.exactOptional(v.picklist(['img', 'ktx2']))}, number);
const strings = v.pipe(v.array(text), v.maxLength(256));
export const ManifestMetadataSchema: v.StrictObjectSchema<{ readonly bindings: v.GenericSchema<ManifestMetadataInput['bindings'], ManifestMetadata['bindings']>; readonly boot: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['boot'], undefined>, Exclude<ManifestMetadata['boot'], undefined>>, undefined>; readonly entries: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['entries'], undefined>, Exclude<ManifestMetadata['entries'], undefined>>, undefined>; readonly gridShardfile: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['gridShardfile'], undefined>, Exclude<ManifestMetadata['gridShardfile'], undefined>>, undefined>; readonly shardfile: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['shardfile'], undefined>, Exclude<ManifestMetadata['shardfile'], undefined>>, undefined>; readonly ground: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['ground'], undefined>, Exclude<ManifestMetadata['ground'], undefined>>, undefined>; readonly groundColour: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['groundColour'], undefined>, Exclude<ManifestMetadata['groundColour'], undefined>>, undefined>; readonly world: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['world'], undefined>, Exclude<ManifestMetadata['world'], undefined>>, undefined>; readonly boundary: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['boundary'], undefined>, Exclude<ManifestMetadata['boundary'], undefined>>, undefined>; readonly hoverSpeedClass: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['hoverSpeedClass'], undefined>, Exclude<ManifestMetadata['hoverSpeedClass'], undefined>>, undefined>; readonly uses: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['uses'], undefined>, Exclude<ManifestMetadata['uses'], undefined>>, undefined>; readonly loadout: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['loadout'], undefined>, Exclude<ManifestMetadata['loadout'], undefined>>, undefined>; readonly species: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['species'], undefined>, Exclude<ManifestMetadata['species'], undefined>>, undefined>; readonly encounters: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['encounters'], undefined>, Exclude<ManifestMetadata['encounters'], undefined>>, undefined>; readonly fight: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['fight'], undefined>, Exclude<ManifestMetadata['fight'], undefined>>, undefined>; readonly creatures: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['creatures'], undefined>, Exclude<ManifestMetadata['creatures'], undefined>>, undefined>; readonly tiers: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['tiers'], undefined>, Exclude<ManifestMetadata['tiers'], undefined>>, undefined>; readonly loot: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['loot'], undefined>, Exclude<ManifestMetadata['loot'], undefined>>, undefined>; readonly hud: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['hud'], undefined>, Exclude<ManifestMetadata['hud'], undefined>>, undefined>; readonly bag: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['bag'], undefined>, Exclude<ManifestMetadata['bag'], undefined>>, undefined>; readonly regionalSimCost: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['regionalSimCost'], undefined>, Exclude<ManifestMetadata['regionalSimCost'], undefined>>, undefined>; readonly spawns: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['spawns'], undefined>, Exclude<ManifestMetadata['spawns'], undefined>>, undefined>; readonly audio: v.GenericSchema<ManifestMetadataInput['audio'], ManifestMetadata['audio']>; readonly api: v.GenericSchema<ManifestMetadataInput['api'], ManifestMetadata['api']>; readonly slug: v.GenericSchema<ManifestMetadataInput['slug'], ManifestMetadata['slug']>; readonly order: v.GenericSchema<ManifestMetadataInput['order'], ManifestMetadata['order']>; readonly status: v.GenericSchema<ManifestMetadataInput['status'], ManifestMetadata['status']>; readonly shardSelect: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['shardSelect'], undefined>, Exclude<ManifestMetadata['shardSelect'], undefined>>, undefined>; readonly name: v.GenericSchema<ManifestMetadataInput['name'], ManifestMetadata['name']>; readonly label: v.GenericSchema<ManifestMetadataInput['label'], ManifestMetadata['label']>; readonly seed: v.GenericSchema<ManifestMetadataInput['seed'], ManifestMetadata['seed']>; readonly biome: v.GenericSchema<ManifestMetadataInput['biome'], ManifestMetadata['biome']>; readonly blurb: v.GenericSchema<ManifestMetadataInput['blurb'], ManifestMetadata['blurb']>; readonly card: v.GenericSchema<ManifestMetadataInput['card'], ManifestMetadata['card']>; readonly style: v.GenericSchema<ManifestMetadataInput['style'], ManifestMetadata['style']>; readonly kitLook: v.GenericSchema<ManifestMetadataInput['kitLook'], ManifestMetadata['kitLook']>; readonly hands: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['hands'], undefined>, Exclude<ManifestMetadata['hands'], undefined>>, undefined>; readonly camera: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['camera'], undefined>, Exclude<ManifestMetadata['camera'], undefined>>, undefined>; readonly weapon: v.GenericSchema<ManifestMetadataInput['weapon'], ManifestMetadata['weapon']>; readonly treeCount: v.GenericSchema<ManifestMetadataInput['treeCount'], ManifestMetadata['treeCount']>; readonly trees: v.GenericSchema<ManifestMetadataInput['trees'], ManifestMetadata['trees']>; readonly assetGlobs: v.GenericSchema<ManifestMetadataInput['assetGlobs'], ManifestMetadata['assetGlobs']>; readonly spawn: v.GenericSchema<ManifestMetadataInput['spawn'], ManifestMetadata['spawn']>; readonly bounds: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['bounds'], undefined>, Exclude<ManifestMetadata['bounds'], undefined>>, undefined>; readonly sky: v.GenericSchema<ManifestMetadataInput['sky'], ManifestMetadata['sky']>; readonly atmosphere: v.GenericSchema<ManifestMetadataInput['atmosphere'], ManifestMetadata['atmosphere']>; readonly grade: v.GenericSchema<ManifestMetadataInput['grade'], ManifestMetadata['grade']>; readonly horizon: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['horizon'], undefined>, Exclude<ManifestMetadata['horizon'], undefined>>, undefined>; readonly minimap: v.GenericSchema<ManifestMetadataInput['minimap'], ManifestMetadata['minimap']>; readonly pois: v.GenericSchema<ManifestMetadataInput['pois'], ManifestMetadata['pois']>; readonly explore: v.GenericSchema<ManifestMetadataInput['explore'], ManifestMetadata['explore']>; readonly captureProbes: v.ExactOptionalSchema<v.ArraySchema<v.GenericSchema<Exclude<ManifestMetadataInput['captureProbes'], undefined>[number], Exclude<ManifestMetadata['captureProbes'], undefined>[number]>, undefined>, undefined>; readonly next: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['next'], undefined>, Exclude<ManifestMetadata['next'], undefined>>, undefined>; readonly debugOptions: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['debugOptions'], undefined>, Exclude<ManifestMetadata['debugOptions'], undefined>>, undefined>; readonly bodyShadow: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['bodyShadow'], undefined>, Exclude<ManifestMetadata['bodyShadow'], undefined>>, undefined>; readonly ocean: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['ocean'], undefined>, Exclude<ManifestMetadata['ocean'], undefined>>, undefined>; readonly blender: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['blender'], undefined>, Exclude<ManifestMetadata['blender'], undefined>>, undefined>; readonly horizonStrips: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['horizonStrips'], undefined>, Exclude<ManifestMetadata['horizonStrips'], undefined>>, undefined>; readonly assets: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['assets'], undefined>, Exclude<ManifestMetadata['assets'], undefined>>, undefined>; readonly look: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['look'], undefined>, Exclude<ManifestMetadata['look'], undefined>>, undefined>; readonly pondLilyExclusions: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['pondLilyExclusions'], undefined>, Exclude<ManifestMetadata['pondLilyExclusions'], undefined>>, undefined>; readonly faunaTuning: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['faunaTuning'], undefined>, Exclude<ManifestMetadata['faunaTuning'], undefined>>, undefined>; readonly forest: v.ExactOptionalSchema<v.GenericSchema<Exclude<ManifestMetadataInput['forest'], undefined>, Exclude<ManifestMetadata['forest'], undefined>>, undefined>; }, undefined> = v.strictObject({
  bindings,
  boot: v.exactOptional(v.strictObject({barrier: v.exactOptional(v.boolean()), cullBeforeFirstDraw: v.exactOptional(v.boolean()),
    phone: v.exactOptional(v.strictObject({ deferExtras: v.exactOptional(v.boolean()), fragile: v.exactOptional(v.boolean()), trace: v.exactOptional(v.boolean()) })), viewmodelSets: v.exactOptional(v.pipe(v.array(v.picklist(['walnut', 'brushed-steel', 'leather', 'cord', 'bolt', 'anodised', 'polymer', 'gunmetal'])), v.maxLength(8))), shaders: v.exactOptional(v.strictObject({background: v.boolean()})), audio: v.exactOptional(strings), precache: strings, stagedWorld: v.exactOptional(v.boolean()),
    steps: v.exactOptional(v.record(text, v.strictObject({label: text, weight: number}))), bytes: v.exactOptional(v.strictObject({sky: v.exactOptional(text), trees: v.exactOptional(text), cabins: v.exactOptional(text), props: v.exactOptional(text), music: v.exactOptional(text), sfx: v.exactOptional(text)}))})),
  entries: v.exactOptional(v.strictObject({legacy: v.boolean(), shardfile: v.boolean()})),
  gridShardfile: v.exactOptional(text), shardfile: v.exactOptional(text),
  ground: v.exactOptional(v.strictObject({structures: v.literal(true), paths: v.exactOptional(v.literal('plugin'))})),
  groundColour: v.exactOptional(rgb), world: v.exactOptional(v.strictObject({killY: number})),
  boundary: v.exactOptional(v.strictObject({visible: v.boolean()})),
  hoverSpeedClass: v.exactOptional(v.picklist(['shard', 'road'])),
  uses: v.exactOptional(v.pipe(v.array(v.picklist(['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'])), v.maxLength(64))),
  loadout: v.exactOptional(v.strictObject({weapons: strings, tools: strings, start: strings, held: v.exactOptional(text), loans: v.exactOptional(v.pipe(v.array(v.strictObject({id: text, in: v.literal('practice')})), v.maxLength(256), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'Unique practice loans'))), pickups: v.exactOptional(v.array(v.strictObject({id: text, at: text})))})),
  species: v.exactOptional(strings), encounters: v.exactOptional(strings),
  fight: v.exactOptional(v.strictObject({maxHitDamage: v.exactOptional(number), capExempt: v.exactOptional(strings), attackers: v.exactOptional(v.union([number, v.literal('unbounded')])), telegraphed: v.exactOptional(v.boolean()),
    input: v.exactOptional(v.strictObject({bufferMs: number, coyoteMs: number}))})),
  creatures: v.exactOptional(v.strictObject({lowPoly: v.boolean(), waitForModels: v.boolean(), furRim: v.boolean(), tintRange: number, oneMaterial: v.boolean()})),
  // `grid`: rows laid over each tier's while the page is a grid cell (G4; read when the level applies its row)
  tiers: v.exactOptional(v.strictObject({phone: v.exactOptional(tier), desktop: v.exactOptional(tier),
    grid: v.exactOptional(v.strictObject({phone: v.exactOptional(tier), desktop: v.exactOptional(tier)}))})),
  loot: v.exactOptional(v.strictObject({coins: v.exactOptional(v.boolean())})),
  hud: v.exactOptional(v.strictObject({dayBadge: v.exactOptional(v.boolean()), bands: v.exactOptional(v.pipe(v.array(v.picklist(['band.1', 'band.2', 'band.3', 'band.4', 'band.5', 'band.6'])), v.maxLength(6)))})),
  bag: v.exactOptional(v.strictObject({skinsTitle: v.exactOptional(text), tabs: strings, pack: v.strictObject({slots: number, keeps: v.exactOptional(strings)})})),
  regionalSimCost: v.exactOptional(v.strictObject({residentMB: number, rev: text, device: text, evidence: text})),
  spawns: v.exactOptional(v.pipe(v.array(v.strictObject({kind: text, count: number, variants: v.exactOptional(strings),
    anchor: v.exactOptional(v.strictObject({x: number, z: number, rMin: number, rMax: number})), canopy: v.boolean(), trailBand: v.tuple([number, number])})), v.maxLength(256))),
  audio: v.strictObject({ambience: text, score: text, catalogue:v.exactOptional(v.literal(true)), alertOnlyHostile: v.exactOptional(v.boolean()), bed: v.exactOptional(text), samples: v.exactOptional(v.strictObject({loopGains: v.record(text, number), omitLoops: v.exactOptional(strings), omitShots: v.exactOptional(strings)}))}),
  api: v.literal(1), slug: v.pipe(text, v.regex(/^(?:_[a-z]+|[a-z][a-z0-9-]*)$/u)),
  order: number, status: v.picklist(['live', 'experimental', 'earlyAccess', 'hidden']), shardSelect: v.exactOptional(v.boolean()),
  name: text, label: text, seed: v.pipe(number, v.integer()),
  biome: text, blurb: text, card: v.strictObject({ thumb: image, portrait: image, landscape: image }),
  style: text, kitLook: v.picklist(['toon', 'painterly', 'pbr']), hands: v.exactOptional(v.picklist(['toon', 'pbr'])),
  camera: v.exactOptional(v.strictObject({ portraitFov: v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(179)) })),
  weapon: v.picklist(['crossbow', 'sword', 'custom']), treeCount: v.pipe(number, v.integer(), v.minValue(0)),
  trees: v.strictObject({ factory: v.exactOptional(v.literal('none')), noun: text, bark: v.exactOptional(text), twigAtlas: v.exactOptional(text), set: v.exactOptional(text), treeSet: v.exactOptional(v.literal('world/trees')), drawnBy: v.exactOptional(v.literal('model')),
    setVariants: v.exactOptional(v.array(v.strictObject({name: text, species: text, height: number, trunk: number, collider: number}))) }),
  assetGlobs: v.pipe(v.array(text), v.maxLength(128)),
  spawn: v.strictObject({ x: number, y: v.exactOptional(number), z: number, yaw: number }),
  bounds: v.exactOptional(v.strictObject({ x0: number, x1: number, z0: number, z1: number, floor: number })),
  sky: v.strictObject({ hdri: v.exactOptional(v.union([image, v.pipe(text, v.regex(/^[a-z0-9_-]+$/u))])), sunColor: rgb, sunIntensity: number,
    envIntensity: number, bgIntensity: number, fogSunColor: rgb, cloudSunColor: rgb,
    hemiSky: number, hemiGround: number, hemiIntensity: number,
    sun: v.exactOptional(v.strictObject({ azimuth: number, elevation: number })),
    planet: v.exactOptional(v.strictObject({ azimuth: number, elevation: number, size: number, tilt: number, roll: v.exactOptional(number) })),
    painted: v.exactOptional(v.strictObject({ zenith: rgb, horizon: rgb, ground: rgb, glow: rgb })) }),
  atmosphere: v.strictObject({ edgeHaze: v.exactOptional(v.boolean()), wetSurfaces: v.exactOptional(v.boolean()),
    weather: v.exactOptional(v.boolean()), fogHeight: number, fogHeightFalloff: number,
    fogHeightDensity: number, fogDistDensity: number, volumetricSunColor: rgb,
    volumetric: v.exactOptional(v.strictObject({ height: number, falloff: number, density: number, strength: number })) }),
  grade: v.strictObject({ saturation: number, brightness: number, contrast: number, bloomIntensity: number,
    bloomThreshold: number, shadowTint: rgb, highTint: rgb, lift: rgb, gain: rgb, gamma: number }),
  horizon: v.exactOptional(v.strictObject({ rings: v.pipe(v.array(ring), v.maxLength(32)), cloudSea: v.boolean() })),
  minimap: v.strictObject({ image, openWater: v.exactOptional(v.strictObject({level: number, deepDepth: number})), outside: v.exactOptional(text) }),
  pois: v.pipe(v.array(v.strictObject({ id: text, name: text, x: number, z: number, r: v.exactOptional(number) })), v.maxLength(256)),
  explore: v.strictObject({ art, compare: v.exactOptional(v.array(v.strictObject({id: text, label: text, model: v.pipe(v.string(), v.maxLength(512)), target: text, live: image, image}))) }),
  captureProbes: v.exactOptional(v.array(v.strictObject({name: text, x: number, z: number, yaw: number, pitch: number}))),
  next: v.exactOptional(text), debugOptions: v.exactOptional(strings), bodyShadow: v.exactOptional(v.boolean()),
  ocean: v.exactOptional(v.strictObject({level: number, shallowColor: rgb, deepColor: rgb, deepDepth: number})),
  blender: v.exactOptional(v.strictObject({area: v.strictObject({x0: number, x1: number, z0: number, z1: number}), models: strings})),
  horizonStrips: v.exactOptional(v.strictObject({day: image, night: image, elMin: number, elMax: number, scale: v.exactOptional(number), phone: v.exactOptional(v.strictObject({day: image, night: image}))})),
  assets: v.exactOptional(v.strictObject({groundLayers: v.tuple([text, text, text, text]), groundTints: v.tuple([rgb, rgb, rgb, rgb]), slabRock: text, boreal: v.exactOptional(v.strictObject({normalK: v.tuple([number, number, number, number]), trailDust: v.tuple([number, number, number, number]), grassTint: rgb}))})),
  look: v.exactOptional(v.strictObject({grade: v.strictObject({shadowTint: rgb}), curve: number, vibrance: number, vol: number, fogDist: number, sat: number, ambient: number, sky: number, dayMist: number})),
  pondLilyExclusions: v.exactOptional(v.array(v.strictObject({x: number, z: number, r: number}))),
  faunaTuning: v.exactOptional(v.record(text, v.strictObject({sightRange: v.exactOptional(number), sightRangeGraze: v.exactOptional(number), sightCone: v.exactOptional(number), hearWalk: v.exactOptional(number), hearSprint: v.exactOptional(number), noticeRate: v.exactOptional(number), impactAlert: v.exactOptional(number)}))),
  forest: v.exactOptional(v.strictObject({spacing: number, densityFreq: number, clearings: v.tuple([number, number]), maxSlope: number, tintHue: number, tintHueJitter: v.tuple([number, number]), tintSat: v.tuple([number, number]), tintLight: v.tuple([number, number]), largeVariantChance: number,
    understory: v.exactOptional(v.strictObject({ferns: number, shrubs: number, fernCanopy: v.boolean()})), speciesTraits: v.exactOptional(v.array(v.strictObject({id: text, scale: v.tuple([number, number]), grows: v.boolean(), girth: number, spacing: v.picklist(['normal','wide','tight']), hue: v.exactOptional(number)})))})),
});
/** Validated authored discovery output, with plain image paths. */

/** Parse authored JSON without loading native code or constructing services. */
export function parseManifestMetadata(input: unknown, expectedSlug?: string): ManifestMetadata {
  const data = v.parse(ManifestMetadataSchema, input);
  const { slug: identity } = data;
  if (expectedSlug !== undefined && identity !== expectedSlug) throw new Error('Manifest identity differs from its folder');
  return data;
}

const captureVector = v.strictTuple([number, number, number]);
const capturePoses: v.GenericSchema<CapturePoseRowsInput, CapturePoseRows> = v.record(text, v.strictObject({ eye: captureVector, yaw: number, pitch: number,
  feet: v.exactOptional(captureVector), mockup: v.string(), frame: v.string(),
  probe: v.exactOptional(v.strictObject({ name: v.exactOptional(v.string()), x: v.exactOptional(number),
    y: v.exactOptional(number), z: v.exactOptional(number), yaw: v.exactOptional(number), pitch: v.exactOptional(number) })),
}));
/** Admit manifest-bound diagnostic pose JSON without weakening fixed-size vector checks. */
export function parseCapturePoses(input: unknown): v.InferOutput<typeof capturePoses> { return v.parse(capturePoses, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type ManifestBindingRowsInput = ManifestBindingRows;
export interface ManifestBindingRows {
    module: string;
    export: string;
}
export type FixedForestQueriesRowsInput = FixedForestQueriesRows;
export interface FixedForestQueriesRows {
    platform: 'fixed';
    density: number;
}
export type ManifestMetadataInput = ManifestMetadata;
export interface ManifestMetadataFields {
    bindings: {
        accent: string;
        budgets: (ManifestBindingRows) | ({
            program: true;
        });
        runtimeCost?: ManifestBindingRows;
        navigation?: (ManifestBindingRows) | ({
            program: true;
        });
        groundRows?: ManifestBindingRows;
        groundColourSamples?: ManifestBindingRows;
        surfaceSamples?: ManifestBindingRows;
        forestMaskSamples?: ManifestBindingRows;
        mapGroundSamples?: ManifestBindingRows;
        navmesh?: ManifestBindingRows;
        mapPalette?: (ManifestBindingRows) | ({
            program: true;
        });
        poses?: (ManifestBindingRows) | ({
            program: true;
        });
        audioCues?: (ManifestBindingRows) | ({
            program: true;
        });
        boot?: ({
            platform: 'page-mode';
            rows: {
                module: v.InferOutput<(typeof binding)['entries']['module']>;
                export: 'default';
            } | { program: true };
        }) | ({
            files: (ManifestBindingRows) | ({
                program: true;
            });
            sources: (ManifestBindingRows) | ({
                program: true;
            });
            lateReads?: (ManifestBindingRows) | ({
                program: true;
            });
            bakedUnread?: ManifestBindingRows;
            audio?: ManifestBindingRows;
            explore?: ({
                program: true;
            }) | ({
                module: string;
                export: 'default';
            });
        });
        forestQueries?: (ManifestBindingRows) | ({
            platform: 'declared';
            rows: ManifestBindingRows;
        }) | (FixedForestQueriesRows);
        pondClip?: (ManifestBindingRows) | ({
            platform: 'declared';
            rows: ManifestBindingRows;
        });
        sword?: (ManifestBindingRows) | ({
            rows: string;
        }) | ({
            platform: 'graph';
            file: string;
        });
        audioPreload?: ManifestBindingRows;
        posesLoader?: ManifestBindingRows;
        spawns?: ManifestBindingRows;
        entry?: {
            platform: 'client-plan';
            retainHomeRuntime: boolean;
            stagesOwner: 'declared' | 'runtime';
            styles?: (string)[];
        };
        ground?: (ManifestBindingRows) | ({
            platform: 'declared';
            rows: ManifestBindingRows;
        });
        render?: (ManifestBindingRows) | ({
            platform: 'painted' | 'toon';
        }) | ({
            platform: 'keyed';
            channels: string;
            looks: ManifestBindingRows;
            trim: ManifestBindingRows;
            trimRow: string;
        }) | ({
            platform: 'post';
            file: string;
            field: (string)[];
        });
        load?: {
            module: string;
        };
        ktx2?: { program: true } | ({
            platform: 'page-mode';
            rows: {
                module: v.InferOutput<(typeof binding)['entries']['module']>;
                export: 'default';
            } | { program: true };
        }) | ({
            module: string;
        }) | (ManifestBindingRows);
        roster?: ({
            call: boolean;
        } & ManifestBindingRows) | ({
            platform: 'held';
            rows: string;
        });
    };
    boot?: {
        barrier?: boolean;
        cullBeforeFirstDraw?: boolean;
        phone?: {
            deferExtras?: boolean;
            fragile?: boolean;
            trace?: boolean;
        };
        viewmodelSets?: ('walnut' | 'brushed-steel' | 'leather' | 'cord' | 'bolt' | 'anodised' | 'polymer' | 'gunmetal')[];
        shaders?: {
            background: boolean;
        };
        audio?: (string)[];
        precache: (string)[];
        stagedWorld?: boolean;
        steps?: Record<string, {
            label: string;
            weight: number;
        }>;
        bytes?: {
            sky?: string;
            trees?: string;
            cabins?: string;
            props?: string;
            music?: string;
            sfx?: string;
        };
    };
    entries?: {
        legacy: boolean;
        shardfile: boolean;
    };
    gridShardfile?: string;
    shardfile?: string;
    ground?: {
        structures: true;
        paths?: 'plugin';
    };
    groundColour?: [
        number,
        number,
        number
    ];
    world?: {
        killY: number;
    };
    boundary?: {
        visible: boolean;
    };
    hoverSpeedClass?: 'shard' | 'road';
    uses?: ('weather' | 'dayCycle' | 'bosses' | 'elites' | 'spawns' | 'quests' | 'swim' | 'hover' | 'explore' | 'practice' | 'coins' | 'loot' | 'compendium' | 'feats' | 'bag.pack')[];
    loadout?: {
        weapons: (string)[];
        tools: (string)[];
        start: (string)[];
        held?: string;
        loans?: ({
            id: string;
            in: 'practice';
        })[];
        pickups?: ({
            id: string;
            at: string;
        })[];
    };
    species?: (string)[];
    encounters?: (string)[];
    fight?: {
        maxHitDamage?: number;
        capExempt?: (string)[];
        attackers?: (number) | ('unbounded');
        telegraphed?: boolean;
        input?: {
            bufferMs: number;
            coyoteMs: number;
        };
    };
    creatures?: {
        lowPoly: boolean;
        waitForModels: boolean;
        furRim: boolean;
        tintRange: number;
        oneMaterial: boolean;
    };
    tiers?: {
        phone?: ({
            aa?: 'fxaa' | 'smaa' | 'off';
            slices?: boolean;
            skipRaysOffscreen?: boolean;
            envSteps?: boolean;
            pointLightSkip?: boolean;
            godRays?: boolean;
            ao?: boolean;
            textures?: 'img' | 'ktx2';
        }) & Record<string, number>;
        desktop?: ({
            aa?: 'fxaa' | 'smaa' | 'off';
            slices?: boolean;
            skipRaysOffscreen?: boolean;
            envSteps?: boolean;
            pointLightSkip?: boolean;
            godRays?: boolean;
            ao?: boolean;
            textures?: 'img' | 'ktx2';
        }) & Record<string, number>;
        grid?: {
            phone?: ({
                aa?: 'fxaa' | 'smaa' | 'off';
                slices?: boolean;
                skipRaysOffscreen?: boolean;
                envSteps?: boolean;
                pointLightSkip?: boolean;
                godRays?: boolean;
                ao?: boolean;
                textures?: 'img' | 'ktx2';
            }) & Record<string, number>;
            desktop?: ({
                aa?: 'fxaa' | 'smaa' | 'off';
                slices?: boolean;
                skipRaysOffscreen?: boolean;
                envSteps?: boolean;
                pointLightSkip?: boolean;
                godRays?: boolean;
                ao?: boolean;
                textures?: 'img' | 'ktx2';
            }) & Record<string, number>;
        };
    };
    loot?: {
        coins?: boolean;
    };
    hud?: {
        dayBadge?: boolean;
        bands?: ('band.1' | 'band.2' | 'band.3' | 'band.4' | 'band.5' | 'band.6')[];
    };
    bag?: {
        skinsTitle?: string;
        tabs: (string)[];
        pack: {
            slots: number;
            keeps?: (string)[];
        };
    };
    regionalSimCost?: {
        residentMB: number;
        rev: string;
        device: string;
        evidence: string;
    };
    spawns?: ({
        kind: string;
        count: number;
        variants?: (string)[];
        anchor?: {
            x: number;
            z: number;
            rMin: number;
            rMax: number;
        };
        canopy: boolean;
        trailBand: [
            number,
            number
        ];
    })[];
    audio: {
        ambience: string;
        score: string;
        catalogue?: true;
        alertOnlyHostile?: boolean;
        bed?: string;
        samples?: {
            loopGains: Record<string, number>;
            omitLoops?: (string)[];
            omitShots?: (string)[];
        };
    };
    api: 1;
    slug: string;
    order: number;
    status: 'live' | 'experimental' | 'earlyAccess' | 'hidden';
    shardSelect?: boolean;
    name: string;
    label: string;
    seed: number;
    biome: string;
    blurb: string;
    card: {
        thumb: string;
        portrait: string;
        landscape: string;
    };
    style: string;
    kitLook: 'toon' | 'painterly' | 'pbr';
    hands?: 'toon' | 'pbr';
    camera?: {
        portraitFov: number;
    };
    weapon: 'crossbow' | 'sword' | 'custom';
    treeCount: number;
    trees: {
        factory?: 'none';
        noun: string;
        bark?: string;
        twigAtlas?: string;
        set?: string;
        treeSet?: 'world/trees';
        drawnBy?: 'model';
        setVariants?: ({
            name: string;
            species: string;
            height: number;
            trunk: number;
            collider: number;
        })[];
    };
    assetGlobs: (string)[];
    spawn: {
        x: number;
        y?: number;
        z: number;
        yaw: number;
    };
    bounds?: {
        x0: number;
        x1: number;
        z0: number;
        z1: number;
        floor: number;
    };
    sky: {
        hdri?: string;
        sunColor: [
            number,
            number,
            number
        ];
        sunIntensity: number;
        envIntensity: number;
        bgIntensity: number;
        fogSunColor: [
            number,
            number,
            number
        ];
        cloudSunColor: [
            number,
            number,
            number
        ];
        hemiSky: number;
        hemiGround: number;
        hemiIntensity: number;
        sun?: {
            azimuth: number;
            elevation: number;
        };
        planet?: {
            azimuth: number;
            elevation: number;
            size: number;
            tilt: number;
            roll?: number;
        };
        painted?: {
            zenith: [
                number,
                number,
                number
            ];
            horizon: [
                number,
                number,
                number
            ];
            ground: [
                number,
                number,
                number
            ];
            glow: [
                number,
                number,
                number
            ];
        };
    };
    atmosphere: {
        edgeHaze?: boolean;
        wetSurfaces?: boolean;
        weather?: boolean;
        fogHeight: number;
        fogHeightFalloff: number;
        fogHeightDensity: number;
        fogDistDensity: number;
        volumetricSunColor: [
            number,
            number,
            number
        ];
        volumetric?: {
            height: number;
            falloff: number;
            density: number;
            strength: number;
        };
    };
    grade: {
        saturation: number;
        brightness: number;
        contrast: number;
        bloomIntensity: number;
        bloomThreshold: number;
        shadowTint: [
            number,
            number,
            number
        ];
        highTint: [
            number,
            number,
            number
        ];
        lift: [
            number,
            number,
            number
        ];
        gain: [
            number,
            number,
            number
        ];
        gamma: number;
    };
    horizon?: {
        rings: ({
            r: number;
            base: number;
            color: [
                number,
                number,
                number
            ];
            top: [
                number,
                number,
                number
            ];
            snowLine: number;
            haze: number;
            bands: ({
                azimuth: number;
                spread: number;
                height: number;
                rough: number;
            })[];
            floor: number;
        })[];
        cloudSea: boolean;
    };
    minimap: {
        image: string;
        openWater?: {
            level: number;
            deepDepth: number;
        };
        outside?: string;
    };
    pois: ({
        id: string;
        name: string;
        x: number;
        z: number;
        r?: number;
    })[];
    explore: {
        art: {
            world: string;
            models: string;
            sets: string;
            practice: string;
        };
        compare?: ({
            id: string;
            label: string;
            model: string;
            target: string;
            live: string;
            image: string;
        })[];
    };
    captureProbes?: ({
        name: string;
        x: number;
        z: number;
        yaw: number;
        pitch: number;
    })[];
    next?: string;
    debugOptions?: (string)[];
    bodyShadow?: boolean;
    ocean?: {
        level: number;
        shallowColor: [
            number,
            number,
            number
        ];
        deepColor: [
            number,
            number,
            number
        ];
        deepDepth: number;
    };
    blender?: {
        area: {
            x0: number;
            x1: number;
            z0: number;
            z1: number;
        };
        models: (string)[];
    };
    horizonStrips?: {
        day: string;
        night: string;
        elMin: number;
        elMax: number;
        scale?: number;
        phone?: {
            day: string;
            night: string;
        };
    };
    assets?: {
        groundLayers: [
            string,
            string,
            string,
            string
        ];
        groundTints: [
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ]
        ];
        slabRock: string;
        boreal?: {
            normalK: [
                number,
                number,
                number,
                number
            ];
            trailDust: [
                number,
                number,
                number,
                number
            ];
            grassTint: [
                number,
                number,
                number
            ];
        };
    };
    look?: {
        grade: {
            shadowTint: [
                number,
                number,
                number
            ];
        };
        curve: number;
        vibrance: number;
        vol: number;
        fogDist: number;
        sat: number;
        ambient: number;
        sky: number;
        dayMist: number;
    };
    pondLilyExclusions?: ({
        x: number;
        z: number;
        r: number;
    })[];
    faunaTuning?: Record<string, {
        sightRange?: number;
        sightRangeGraze?: number;
        sightCone?: number;
        hearWalk?: number;
        hearSprint?: number;
        noticeRate?: number;
        impactAlert?: number;
    }>;
    forest?: {
        spacing: number;
        densityFreq: number;
        clearings: [
            number,
            number
        ];
        maxSlope: number;
        tintHue: number;
        tintHueJitter: [
            number,
            number
        ];
        tintSat: [
            number,
            number
        ];
        tintLight: [
            number,
            number
        ];
        largeVariantChance: number;
        understory?: {
            ferns: number;
            shrubs: number;
            fernCanopy: boolean;
        };
        speciesTraits?: ({
            id: string;
            scale: [
                number,
                number
            ];
            grows: boolean;
            girth: number;
            spacing: 'normal' | 'wide' | 'tight';
            hue?: number;
        })[];
    };
}
export type CapturePoseRowsInput = CapturePoseRows;
export type CapturePoseRows = Record<string, {
    eye: [
        number,
        number,
        number
    ];
    yaw: number;
    pitch: number;
    feet?: [
        number,
        number,
        number
    ];
    mockup: string;
    frame: string;
    probe?: {
        name?: string;
        x?: number;
        y?: number;
        z?: number;
        yaw?: number;
        pitch?: number;
    };
}>;

/** Closed admitted fields keep the original record-compatible object type. */
export type ManifestMetadata = { [Key in keyof ManifestMetadataFields]: ManifestMetadataFields[Key] };
