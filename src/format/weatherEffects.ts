import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const id = v.pipe(v.string(), v.maxLength(256));
const numbers = v.pipe(v.array(finite), v.maxLength(2_000_000));
const vector = v.tuple([finite, finite, finite]);
type NumericStorage = 'Int8Array' | 'Uint8Array' | 'Uint8ClampedArray' | 'Int16Array' | 'Uint16Array' | 'Int32Array' | 'Uint32Array' | 'Float32Array' | 'Float64Array';
const storage = v.picklist(['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array']);

interface GeometryAttribute {
  readonly itemSize: number; readonly type: NumericStorage; readonly array: number[];
  readonly normalized: boolean; readonly name?: string; readonly usage?: number; readonly gpuType?: number;
}
/** Native BufferGeometry JSON with complete attributes and bounded index ranges. */
export interface WeatherGeometry {
  readonly metadata: { readonly version: number; readonly type: 'BufferGeometry'; readonly generator: string };
  readonly type: 'BufferGeometry'; readonly name?: string;
  readonly data: {
    readonly attributes: Record<string, GeometryAttribute>;
    readonly index?: { readonly type: 'Uint16Array' | 'Uint32Array'; readonly array: number[] };
    readonly groups?: { readonly start: number; readonly count: number; readonly materialIndex: number }[];
    readonly boundingSphere?: { readonly center: [number, number, number]; readonly radius: number };
  };
}
const geometry: v.GenericSchema<unknown, WeatherGeometry> = v.pipe(v.strictObject({
  metadata: v.strictObject({ version: finite, type: v.literal('BufferGeometry'), generator: id }),
  type: v.literal('BufferGeometry'), name: v.exactOptional(id),
  data: v.strictObject({
    attributes: v.pipe(v.record(id, v.strictObject({
      itemSize: v.pipe(natural, v.minValue(1), v.maxValue(16)), type: storage, array: numbers,
      normalized: v.boolean(), name: v.exactOptional(id), usage: v.exactOptional(natural), gpuType: v.exactOptional(natural),
    })), v.maxEntries(32)),
    index: v.exactOptional(v.strictObject({ type: v.picklist(['Uint16Array', 'Uint32Array']), array: v.pipe(v.array(natural), v.maxLength(2_000_000)) })),
    groups: v.exactOptional(v.pipe(v.array(v.strictObject({ start: natural, count: natural, materialIndex: natural })), v.maxLength(128))),
    boundingSphere: v.exactOptional(v.strictObject({ center: vector, radius: v.pipe(finite, v.minValue(0)) })),
  }),
}), v.check(row => {
  const position = row.data.attributes['position'];
  if (position?.itemSize !== 3) return false;
  const count = position.array.length / 3, index = row.data.index;
  const extent = index?.array.length ?? count;
  return Number.isInteger(count)
    && Object.values(row.data.attributes).every(attribute => attribute.array.length === count * attribute.itemSize)
    && (index === undefined || index.array.every(value => value < count && value <= (index.type === 'Uint16Array' ? 65535 : 4294967295)))
    && (row.data.groups ?? []).every(group => group.start + group.count <= extent);
}, 'Complete native geometry attributes and index ranges'));

interface PaintedSkyData {
  readonly schema: Record<string, 'number' | 'colour'>;
  readonly initial: Record<string, number | [number, number, number]>;
  readonly day: Record<string, number | number[]>;
}
const sky: v.GenericSchema<unknown, PaintedSkyData> = v.pipe(v.strictObject({
  schema: v.pipe(v.record(id, v.picklist(['number', 'colour'])), v.maxEntries(128)),
  initial: v.pipe(v.record(id, v.union([finite, vector])), v.maxEntries(128)),
  day: v.pipe(v.record(id, v.union([finite, numbers])), v.maxEntries(128)),
}), v.check(row => Object.keys(row.schema).length === Object.keys(row.initial).length
  && Object.entries(row.schema).every(([name, kind]) => Object.hasOwn(row.initial, name)
    && (kind === 'colour' || typeof row.initial[name] === 'number')), 'Complete painted-sky initial values'));

/** Shared weather presentation resource table. Shapes keep native JSON and
 * arbitrary named numeric tables hold texture bytes or instance matrices.
 * The declaring forest-weather row binds each table to its original owner. */
export interface WeatherEffects {
  readonly shapes: Record<string, WeatherGeometry>;
  readonly sky?: PaintedSkyData;
  readonly [name: string]: Record<string, WeatherGeometry> | PaintedSkyData | number[] | undefined;
}
/** Complete native weather resource grammar; family credit is separate. */
export const WeatherEffectsSchema: v.GenericSchema<unknown, WeatherEffects> = v.pipe(v.objectWithRest({
  shapes: v.pipe(v.record(id, geometry), v.maxEntries(32)), sky: v.exactOptional(sky),
}, numbers), v.check(row => Object.keys(row).length <= 32, 'Bounded weather resource tables'));

/** Validate the complete resource document without rewriting its payload. */
export function parseWeatherEffects(input: unknown): WeatherEffects { return v.parse(WeatherEffectsSchema, input); }
