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
