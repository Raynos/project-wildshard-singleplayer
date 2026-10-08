/**
 * A declared forest (SHARD-PLATFORM G227): the trees a world placed at boot (`placeForest`), baked as instance records so
 * the shardfile carries them. The forest still draws through the engine's `Forest` (its LOD bands, dissolves, wind, canopy
 * map, trunk capsules and the tree model's instanced culler, no facade multi-draw), fed the records instead of placing
 * (`Forest.build({ instances })`): the trees, their order and their matrices are the placed ones, so look and cost match.
 *
 * `props.forest` = `{ records, variants }`: `records` is one admitted `binary` file in the engine's tree record format
 * (`encodeTreeRecords`: per tree x, y, z, r, variant, scale, rot, height, tint), `variants` the tree variant names in the
 * forest's variant order (each record's `variant` indexes it). The client refuses a forest whose tree set's variants are not
 * exactly these names in this order, so a record never draws another tree.
 *
 * The schema lives here, outside the format file (format ownership: sp-x5 wires `forest: v.exactOptional(ForestRecordsSchema)`
 * into `PropsSchema` and calls `validateForestRecords` from the props reference check).
 */
import * as v from 'valibot';
import { decodeTreeRecords, type PlantSpec, type TreeInstance } from '@wildshard/engine/world/forest/placement';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/u), v.maxLength(64));
/** The most trees a declared forest carries (the engine's own TREE_COUNT cap is lower). */
export const FOREST_RECORD_CAP = 20_000;

/** `props.forest`: baked forest instance records and their variant names. */
export const ForestRecordsSchema = v.strictObject({
  records: ref,
  variants: v.pipe(v.array(name), v.minLength(1), v.maxLength(64), v.check((rows) => new Set(rows).size === rows.length, 'unique variant names')),
});
/** An admitted declared forest. */
export type ForestRecords = v.InferOutput<typeof ForestRecordsSchema>;

const read = new WeakMap<object, ForestRecords | undefined>();
/** A props section's declared forest (undefined: none). Reads the additive `forest` field whether or not `PropsSchema` declares it yet. */
export function forestRecordsOf(props: object): ForestRecords | undefined {
  if (read.has(props)) return read.get(props);
  const raw: unknown = 'forest' in props ? props.forest : undefined;
  const value = raw === undefined ? undefined : v.parse(ForestRecordsSchema, raw);
  read.set(props, value); return value;
}

/** Refuse records that are not an admitted `binary` file, or bytes that do not decode against the declared variant count. */
export function validateForestRecords(forest: ForestRecords, context: { files: readonly { hash: string; kind: string }[]; assets?: ReadonlyMap<string, Uint8Array> }): void {
  if (context.files.find((file) => file.hash === forest.records)?.kind !== 'binary') throw new Error('props.forest records must be an admitted binary file');
  const bytes = context.assets?.get(forest.records);
  if (bytes === undefined) return;
  const trees = decodeTreeRecords(bytes, forest.variants.map(() => ({ trunkRadius: 0, height: 0 })));
  if (trees.length > FOREST_RECORD_CAP) throw new Error(`props.forest carries ${trees.length} trees, over ${FOREST_RECORD_CAP}`);
}

/**
 * The declared trees for a forest whose tree set has `variants` (named, in its order, with their plant specs): refuses a
 * set whose names differ from the declaration, then decodes (species from the variant, as placement assigns them).
 */
export function clientForestTrees(forest: ForestRecords, bytes: Uint8Array, variants: readonly (PlantSpec & { readonly name: string })[]): TreeInstance[] {
  const names = variants.map((row) => row.name);
  if (names.length !== forest.variants.length || names.some((row, i) => row !== forest.variants[i])) throw new Error(`props.forest variants [${forest.variants.join(', ')}] are not the tree set's [${names.join(', ')}]`);
  return decodeTreeRecords(bytes, variants);
}
