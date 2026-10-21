import * as v from 'valibot';

const coord = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const point = v.tuple([coord, coord]);
const circle = v.pipe(v.strictObject({ kind: v.literal('circle'), x: coord, z: coord, radius: v.pipe(coord, v.minValue(0.01)) }), v.check((s) => Math.abs(s.x) + s.radius <= 250 && Math.abs(s.z) + s.radius <= 250, 'pool fits cell'));
function simplePolygon(points: readonly (readonly [number, number])[]): boolean {
  if (new Set(points.map((p) => `${p[0]}/${p[1]}`)).size !== points.length) return false;
  let area = 0;
  const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) => ((b[0] ?? 0) - (a[0] ?? 0)) * ((c[1] ?? 0) - (a[1] ?? 0)) - ((b[1] ?? 0) - (a[1] ?? 0)) * ((c[0] ?? 0) - (a[0] ?? 0));
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]; if (a === undefined || b === undefined) return false;
    area += a[0] * b[1] - a[1] * b[0];
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length]; if (c === undefined || d === undefined) return false;
      const overlap = Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
      if (overlap && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return false;
    }
  }
  return Math.abs(area) > 1e-6;
}
const polygon = v.pipe(v.strictObject({ kind: v.literal('polygon'), points: v.pipe(v.array(point), v.minLength(3), v.maxLength(64)) }), v.check((s) => simplePolygon(s.points), 'simple nondegenerate pool polygon'));
// `under` names a live level (the stream's `levels`, its rest value) that floods the point: its surface is the higher of the two
const streamPoint = v.strictObject({ x: coord, z: coord, level: coord, under: v.optional(id) });
const levels = v.optional(v.pipe(v.record(id, coord), v.check((rows) => Object.keys(rows).length <= 8, 'at most 8 live levels')));
const dryEntries = v.optional(v.pipe(v.array(v.picklist(['north', 'east', 'south', 'west'])), v.maxLength(4), v.check((rows) => new Set(rows).size === rows.length, 'unique dry entryways')));
const body = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('pool'), level: coord, shape: v.variant('kind', [circle, polygon]), dryEntries }),
  v.strictObject({ id: v.literal('sea'), kind: v.literal('sea'), level: coord, waves: v.boolean(), dryEntries }),
  v.pipe(v.strictObject({ id, kind: v.literal('stream'), width: v.pipe(coord, v.minValue(0.01), v.maxValue(100)), points: v.pipe(v.array(streamPoint), v.minLength(2), v.maxLength(128)), levels, dryEntries }), v.check((s) => s.points.every((p, i) => {
    const prev = s.points[i - 1]; return (p.under === undefined || s.levels?.[p.under] !== undefined) && Math.abs(p.x) + s.width / 2 <= 250 && Math.abs(p.z) + s.width / 2 <= 250 && (prev === undefined || p.x !== prev.x || p.z !== prev.z);
  }), 'stream fits cell, has nonzero segments and declares its live levels')),
]);
/** Bounded water declarations; the sea comes last so smaller regions retain their authored rest surfaces. */
export const WaterSchema = v.pipe(v.array(body), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length && rows.every((row, i) => row.kind === 'sea' ? i === rows.length - 1 : row.id !== 'sea'), 'unique water ids and sea last'));
/** A serialisable water section for pools, seas and streams, defaulting to [] in the full format. */
export type ShardWater = v.InferOutput<typeof WaterSchema>;

const param = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
const literal = v.union([v.number(), v.pipe(v.array(v.number()), v.minLength(2), v.maxLength(4))]);
/**
 * A drawn water surface on a look.materials graph (G466 H7, `@wildshard/sdk/looks/waterSurface`): which graph it wears,
 * how it draws, the graph params the host feeds (`bind`: the wave clock, the open water's half-extent, the chunk's half), its static params, an optional baked floor texture (R = floor height; G = the foam
 * proximity the host stamps round standing colliders) and its dry rectangles' sockets. Data only (G454).
 */
export const WaterSurfaceSchema = v.strictObject({
  look: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  name: v.pipe(v.string(), v.maxLength(64)),
  renderOrder: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(16)),
  culled: v.optional(v.boolean(), true),
  /** the engine's wave clock (the boats, swimmers and debris) follows this surface's clock */
  waves: v.optional(v.boolean(), false),
  bind: v.optional(v.strictObject({ clock: v.optional(param), waterHalf: v.optional(param), chunkHalf: v.optional(param) }), {}),
  params: v.optional(v.record(param, literal), {}),
  floor: v.optional(v.strictObject({ texture: param, res: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(2048)), foamReach: v.pipe(v.number(), v.minValue(0.1), v.maxValue(32)), foamBand: v.pipe(v.number(), v.minValue(0), v.maxValue(8)) })),
  dry: v.optional(v.strictObject({ prefix: param, slots: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)), none: v.tuple([v.number(), v.number(), v.number(), v.number()]) })),
});
/** A validated water-surface row. */
export type WaterSurfaceRow = v.InferOutput<typeof WaterSurfaceSchema>;
/** Validate a water-surface row. */
export function parseWaterSurface(input: unknown): WaterSurfaceRow {
  return v.parse(WaterSurfaceSchema, input);
}
