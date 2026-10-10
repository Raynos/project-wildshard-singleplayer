/**
 * A map palette as declared rows (SHARD-PLATFORM M3; ex a dune shard's map look): the manifest's `minimap.palette` (the
 * ground colour at a sample, the overlay painted over it, the named places) built from data. Node-safe: no runtime engine
 * import, so a manifest and a bake can read it. Nothing here knows a shard; the colours, places and strokes are its rows.
 *
 * - The ground starts at `base` and mixes each layer's colour over the colour so far, in order, by the smoothstep of one
 *   field between the layer's `edges` (`height` in metres, `slope`, or the distance from a centre when `centre` is set
 *   and the sample lies inside its `within`), flipped by `invert` and scaled by `gain`.
 * - The overlay draws, in order: every segment's strokes (round caps and joins), the level's trails once per trail
 *   stroke (each stroke with its own dash, or none), then the marks.
 * - Widths, sizes and dashes are metres (scaled by the map's pixels per metre).
 */
import type { MapOverlay, MapPoi, MinimapPalette } from '@wildshard/engine/ui/Minimap';

/** An sRGB colour, 0–255 per channel. */
export type MapRgb = readonly [number, number, number];

/** One layer of the ground paint: `color` mixed over the colour so far by a field's smoothstep between `edges`. */
export interface MapGroundLayer {
  readonly color: MapRgb;
  /** the field: the sample's height or slope, or (with `centre`) its distance from the centre */
  readonly by: 'height' | 'slope' | 'distance';
  readonly edges: readonly [number, number];
  /** the weight's scale (default 1) */
  readonly gain?: number;
  /** the weight is 1 − the smoothstep (nearer the low edge, more of the colour) */
  readonly invert?: boolean;
  /** for `by: 'distance'`: the centre (x, z, metres) and the radius past which the layer paints nothing */
  readonly centre?: { readonly x: number; readonly z: number; readonly within: number };
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
  readonly ground: { readonly base: MapRgb; readonly layers: readonly MapGroundLayer[] };
  readonly segments: readonly MapSegment[];
  readonly trails: readonly MapStroke[];
  readonly marks: readonly MapMark[];
  readonly pois: readonly MapPoi[];
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** `out` = `a` + (`b` − `a`) × `t`, per channel. */
function mix(a: MapRgb, b: MapRgb, t: number, out: [number, number, number]): void {
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
}

/** The layer's weight at a sample, or null where it paints nothing (outside its centre's radius). */
function weight(layer: MapGroundLayer, x: number, z: number, h: number, slope: number): number | null {
  let field = layer.by === 'height' ? h : slope;
  if (layer.by === 'distance') {
    const c = layer.centre;
    if (c === undefined) return null;
    field = Math.hypot(x - c.x, z - c.z);
    if (!(field < c.within)) return null;
  }
  const s = smooth(layer.edges[0], layer.edges[1], field), t = layer.invert === true ? 1 - s : s;
  return layer.gain === undefined ? t : t * layer.gain;
}

/** Paints one mark. */
function mark(m: MapMark, { ctx, toU, toV, ppm }: MapOverlay): void {
  if (m.kind === 'square') { ctx.fillStyle = m.fill; ctx.fillRect(toU(m.x) - m.half * ppm, toV(m.z) - m.half * ppm, 2 * m.half * ppm, 2 * m.half * ppm); return; }
  if (m.kind === 'box') {
    ctx.save(); ctx.translate(toU(m.x), toV(m.z)); ctx.rotate(-m.yaw); ctx.fillStyle = m.fill;
    ctx.fillRect(-(m.width / 2) * ppm, -(m.length / 2) * ppm, m.width * ppm, m.length * ppm); ctx.restore(); return;
  }
  if (m.kind === 'ring') { ctx.lineWidth = m.line * ppm; ctx.strokeStyle = m.stroke; ctx.beginPath(); ctx.arc(toU(m.x), toV(m.z), m.r * ppm, 0, Math.PI * 2); ctx.stroke(); return; }
  ctx.fillStyle = m.fill; ctx.beginPath(); ctx.arc(toU(m.x), toV(m.z), m.r * ppm, 0, Math.PI * 2); ctx.fill();
}

/** A level's `minimap.palette` from its rows: the layered ground, the overlay's strokes and marks, the named places. */
export function mapPalette(row: MapPaletteRow): MinimapPalette {
  const ground = (x: number, z: number, h: number, slope: number, _forest: number, out: [number, number, number]): void => {
    out[0] = row.ground.base[0]; out[1] = row.ground.base[1]; out[2] = row.ground.base[2];
    for (const layer of row.ground.layers) { const t = weight(layer, x, z, h, slope); if (t !== null) mix(out, layer.color, t, out); }
  };
  const overlay = (o: MapOverlay): void => {
    const { ctx, toU, toV, ppm, trails } = o;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of row.segments) for (const k of s.strokes) {
      ctx.lineWidth = k.width * ppm; ctx.strokeStyle = k.style; ctx.beginPath();
      ctx.moveTo(toU(s.from[0]), toV(s.from[1])); ctx.lineTo(toU(s.to[0]), toV(s.to[1])); ctx.stroke();
    }
    for (const k of row.trails) {
      ctx.lineWidth = k.width * ppm; ctx.strokeStyle = k.style; ctx.setLineDash(k.dash === undefined ? [] : [k.dash[0] * ppm, k.dash[1] * ppm]); ctx.beginPath();
      for (const poly of trails) poly.forEach(([x, z], i) => (i ? ctx.lineTo(toU(x), toV(z)) : ctx.moveTo(toU(x), toV(z))));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const m of row.marks) mark(m, o);
  };
  const pois = (): MapPoi[] => row.pois.map((p) => ({ x: p.x, z: p.z, label: p.label, color: p.color }));
  return { ground, overlay, pois };
}
