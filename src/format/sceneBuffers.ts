import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const count = v.pipe(natural, v.maxValue(1_000_000));
const xyz = v.tuple([finite, finite, finite]);
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const buffer = v.strictObject({ id, storage: v.picklist(['f32', 'u16', 'u8']), bytes: v.pipe(v.string(), v.maxLength(8_000_000)),
  stride: v.exactOptional(v.pipe(natural, v.minValue(1), v.maxValue(16))), instanced: v.optional(v.boolean(), false) });
const attribute = v.strictObject({ id, buffer: id, size: v.pipe(natural, v.minValue(1), v.maxValue(4)), offset: v.optional(natural, 0), normalized: v.optional(v.boolean(), false) });
const instances = v.union([count, v.strictObject({ knob: id, threshold: count, below: count, above: count })]);
const geometry = v.strictObject({ id, attributes: v.pipe(v.record(id, id), v.maxEntries(16)), index: v.exactOptional(id), instances: v.exactOptional(instances),
  sphere: v.exactOptional(v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))])) });
const mesh = v.strictObject({ kind: v.picklist(['mesh', 'points']), geometry: id, at: v.optional(xyz, [0, 0, 0]), frustum: v.optional(v.boolean(), true) });
const draw = v.strictObject({ id, name: v.optional(v.pipe(v.string(), v.maxLength(256)), ''), at: v.optional(xyz, [0, 0, 0]),
  draw: v.exactOptional(mesh), levels: v.exactOptional(list(v.strictObject({ from: v.pipe(finite, v.minValue(0)), draw: v.exactOptional(mesh) }), 8)) });
/** Client-only baked draw storage. References preserve typed buffers, attribute sharing and LOD order. */
export const SceneBuffersSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Scene buffers require plain JSON'),
  v.strictObject({ version: v.literal(1), name: v.optional(v.pipe(v.string(), v.maxLength(256)), ''), buffers: list(buffer, 4096), attributes: list(attribute, 8192), geometries: list(geometry, 4096), draws: list(draw, 2048) }),
  v.check(row => {
    const buffers = new Map(row.buffers.map(entry => [entry.id, entry]));
    const attributes = new Map(row.attributes.map(entry => [entry.id, entry]));
    const geometries = new Set(row.geometries.map(entry => entry.id));
    return buffers.size === row.buffers.length && attributes.size === row.attributes.length && geometries.size === row.geometries.length
      && new Set(row.draws.map(entry => entry.id)).size === row.draws.length
      && row.buffers.reduce((sum, entry) => sum + entry.bytes.length, 0) <= 16_000_000
      && row.attributes.every(entry => {
        const source = buffers.get(entry.buffer);
        return source !== undefined && (source.stride === undefined ? entry.offset === 0 : entry.offset + entry.size <= source.stride);
      })
      && row.geometries.every(entry => attributes.get(entry.attributes['position'] ?? '')?.size === 3 && Object.values(entry.attributes).every(key => attributes.has(key))
        && (entry.index === undefined || attributes.get(entry.index)?.size === 1 && buffers.get(attributes.get(entry.index)?.buffer ?? '')?.instanced === false))
      && row.draws.every(entry => (entry.draw === undefined) !== (entry.levels === undefined)
        && (entry.draw === undefined || geometries.has(entry.draw.geometry))
        && (entry.levels === undefined || entry.levels.length > 0 && new Set(entry.levels.map(level => level.from)).size === entry.levels.length
          && entry.levels.every(level => level.draw === undefined || geometries.has(level.draw.geometry))));
  }, 'Unique bounded buffer references and LOD bands'));
export type SceneBuffers = v.InferOutput<typeof SceneBuffersSchema>;
/** Validate all identities and storage extents before constructing any GPU resource. */
export function parseSceneBuffers(input: unknown): SceneBuffers { return v.parse(SceneBuffersSchema, input); }
