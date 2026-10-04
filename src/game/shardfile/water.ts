import * as v from 'valibot';
import { declaredWaterBody } from '@wildshard/engine/world/water/declared';
import type { WaterBody } from '@wildshard/engine/world/water/body';

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
const streamPoint = v.strictObject({ x: coord, z: coord, level: coord });
const dryEntries = v.optional(v.pipe(v.array(v.picklist(['north', 'east', 'south', 'west'])), v.maxLength(4), v.check((rows) => new Set(rows).size === rows.length, 'unique dry entryways')));
const body = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('pool'), level: coord, shape: v.variant('kind', [circle, polygon]), dryEntries }),
  v.strictObject({ id: v.literal('sea'), kind: v.literal('sea'), level: coord, waves: v.boolean(), dryEntries }),
  v.pipe(v.strictObject({ id, kind: v.literal('stream'), width: v.pipe(coord, v.minValue(0.01), v.maxValue(100)), points: v.pipe(v.array(streamPoint), v.minLength(2), v.maxLength(128)), dryEntries }), v.check((s) => s.points.every((p, i) => {
    const prev = s.points[i - 1]; return Math.abs(p.x) + s.width / 2 <= 250 && Math.abs(p.z) + s.width / 2 <= 250 && (prev === undefined || p.x !== prev.x || p.z !== prev.z);
  }), 'stream fits cell and has nonzero segments')),
]);
/** Bounded water declarations; the sea comes last so smaller regions retain their authored rest surfaces. */
export const WaterSchema = v.pipe(v.array(body), v.maxLength(64), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length && rows.every((row, i) => row.kind === 'sea' ? i === rows.length - 1 : row.id !== 'sea'), 'unique water ids and sea last'));
/** A serialisable water section for pools, seas and streams, defaulting to [] in the full format. */
export type ShardWater = v.InferOutput<typeof WaterSchema>;
/** Validate untrusted declarations and return fresh motor-compatible bodies for one level instance. */
export function shardfileWater(input: unknown): WaterBody[] { return v.parse(WaterSchema, input).map(declaredWaterBody); }
