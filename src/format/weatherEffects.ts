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
/** Complete native data block, also used by the arrow's original data-only envelope. */
export const WeatherGeometryDataSchema: v.GenericSchema<unknown, WeatherGeometry['data']> = v.pipe(v.strictObject({
  attributes: v.pipe(v.record(id, v.strictObject({
    itemSize: v.pipe(natural, v.minValue(1), v.maxValue(16)), type: storage, array: numbers,
    normalized: v.boolean(), name: v.exactOptional(id), usage: v.exactOptional(natural), gpuType: v.exactOptional(natural),
  })), v.maxEntries(32)),
  index: v.exactOptional(v.strictObject({ type: v.picklist(['Uint16Array', 'Uint32Array']), array: v.pipe(v.array(natural), v.maxLength(2_000_000)) })),
  groups: v.exactOptional(v.pipe(v.array(v.strictObject({ start: natural, count: natural, materialIndex: natural })), v.maxLength(128))),
  boundingSphere: v.exactOptional(v.strictObject({ center: vector, radius: v.pipe(finite, v.minValue(0)) })),
}), v.check(row => {
  const position = row.attributes['position'];
  if (position?.itemSize !== 3) return false;
  const count = position.array.length / 3, index = row.index;
  const extent = index?.array.length ?? count;
  return Number.isInteger(count)
    && Object.values(row.attributes).every(attribute => attribute.array.length === count * attribute.itemSize)
    && (index === undefined || index.array.every(value => value < count && value <= (index.type === 'Uint16Array' ? 65535 : 4294967295)))
    && (row.groups ?? []).every(group => group.start + group.count <= extent);
}, 'Complete native geometry attributes and index ranges'));
/** The weather's full envelope still requires both metadata and type. */
export const WeatherGeometrySchema: v.GenericSchema<unknown, WeatherGeometry> = v.strictObject({
  metadata: v.strictObject({ version: finite, type: v.literal('BufferGeometry'), generator: id }),
  type: v.literal('BufferGeometry'), name: v.exactOptional(id), data: WeatherGeometryDataSchema,
});
/** BufferGeometryLoader also accepts the original arrow's data-only envelope. */
export const WeatherGeometryPayloadSchema: v.GenericSchema<unknown, Pick<WeatherGeometry, 'data'>> = v.strictObject({ data: WeatherGeometryDataSchema });

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

/** Native geometry, sky and named numeric resource tables. */
export interface WeatherEffects {
  readonly shapes: Record<string, WeatherGeometry>;
  readonly sky?: PaintedSkyData;
  readonly [name: string]: Record<string, WeatherGeometry> | PaintedSkyData | number[] | undefined;
}
/** Complete native weather resource grammar; family credit is separate. */
export const WeatherEffectsSchema: v.GenericSchema<unknown, WeatherEffects> = v.pipe(v.objectWithRest({
  shapes: v.pipe(v.record(id, WeatherGeometrySchema), v.maxEntries(32)), sky: v.exactOptional(sky),
}, numbers), v.check(row => Object.keys(row).length <= 32, 'Bounded weather resource tables'));

/** Validate without rewriting the original payload. */
export function parseWeatherEffects(input: unknown): WeatherEffects { return v.parse(WeatherEffectsSchema, input); }
