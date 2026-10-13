/** Defining root wire sections shared by the authoring SDK and game admission.
 * Native reference/asset/entry/allocator checks stay in game; look and material contracts await DS1.4. */
import * as v from 'valibot';
import { WIRE_CELL, WIRE_TILE_SIZES } from './wireLimits';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { SHARDFILE_VERSION } from './version';
import { CommonsCostsSchema } from './commonsCosts';
import { ScriptBindingsSchema } from './scripts';

const CHUNK_HALF = WIRE_CELL.half, CELL_BELOW = WIRE_CELL.below, CELL_ABOVE = WIRE_CELL.above;
/** Nonnegative safe wire integer. */
export const ShardNaturalSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(ShardNaturalSchema, v.minValue(1));
/** Finite wire number without an imposed gameplay range. */
export const ShardFiniteSchema = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(limits.idCharacters));
/** Local SHA256 content identity. */
export const ShardHashSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Local or commons-qualified SHA256 content reference. */
export const ShardReferenceSchema = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
/** Bounded ordered references to local or commons content. */
export const ShardReferencesSchema = v.pipe(v.array(ShardReferenceSchema), v.maxLength(limits.files + limits.commons));
/** Bounded ordered names in a root declaration. */
export const ShardNamesSchema = v.pipe(v.array(name), v.maxLength(limits.files));
const vec3 = v.tuple([ShardFiniteSchema, ShardFiniteSchema, ShardFiniteSchema]);
/** Ordered local bounds inside the fixed shard cell. */
export const CellBoundsSchema = v.pipe(v.strictObject({ min: vec3, max: vec3 }), v.check((b) => b.min.every((n, i) => n <= (b.max[i] ?? -Infinity)), 'ordered bounds'), v.check((b) => b.min[0] >= -CHUNK_HALF && b.max[0] <= CHUNK_HALF && b.min[2] >= -CHUNK_HALF && b.max[2] <= CHUNK_HALF && b.min[1] >= -CELL_BELOW && b.max[1] <= CELL_ABOVE, 'cell bounds'));
const drawBounds = v.pipe(v.strictObject({ min: vec3, max: vec3 }),
  v.check(b => b.min.every((n, i) => n <= (b.max[i] ?? -Infinity)) && b.min[0] >= -CHUNK_HALF - 1 && b.max[0] <= CHUNK_HALF + 1 && b.min[2] >= -CHUNK_HALF - 1 && b.max[2] <= CHUNK_HALF + 1 && b.min[1] >= -CELL_BELOW && b.max[1] <= CELL_ABOVE, 'bounded visual draw extent'));
const costs = { compressed: ShardNaturalSchema, decoded: ShardNaturalSchema, gpu: ShardNaturalSchema, triangles: ShardNaturalSchema, draws: ShardNaturalSchema };
const tile = v.strictObject({ lod: v.picklist([0, 1]), x: ShardNaturalSchema, z: ShardNaturalSchema, bounds: CellBoundsSchema, drawBounds: v.exactOptional(drawBounds), geometricError: v.pipe(ShardFiniteSchema, v.minValue(0)), files: ShardReferencesSchema, ...costs });
const file = v.strictObject({ hash: ShardHashSchema, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'binary', 'image']), ...costs, dependencies: ShardReferencesSchema, critical: v.boolean() });
const tileCount = (2 * CHUNK_HALF / WIRE_TILE_SIZES.l0) ** 2 + (2 * CHUNK_HALF / WIRE_TILE_SIZES.l1) ** 2;

/** Stable authored shard identity and deterministic seed. */
export const IdentitySchema = v.strictObject({ slug: name, name: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), author: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), revision: positive, seed: ShardNaturalSchema });
/** Wire revision, capabilities and exact commons declarations. */
export const RequiresSchema = v.strictObject({ sdk: v.literal(SHARDFILE_VERSION), capabilities: ShardNamesSchema, commons: v.pipe(v.array(ShardHashSchema), v.maxLength(limits.commons)), commonsWire: v.optional(v.record(ShardHashSchema, ShardNaturalSchema), {}), commonsCosts: v.optional(CommonsCostsSchema, {}) });
/** Authored compressed and resident ceilings. */
export const BudgetsSchema = v.strictObject({ library: v.strictObject({ resident: ShardNaturalSchema, compressed: ShardNaturalSchema }), sim: v.strictObject({ resident: ShardNaturalSchema, compressed: ShardNaturalSchema }), overlap: ShardNaturalSchema });
/** Fixed-step simulation and admitted script binding declarations. */
export const SimSchema = v.strictObject({ fixedHz: v.literal(60), scriptTickDivisor: v.pipe(positive, v.check((n) => 60 % n === 0, 'script divisor divides 60')), commandVersion: v.literal(0), snapshotVersion: v.literal(0), scripts: ShardReferencesSchema, bindings: v.optional(ScriptBindingsSchema, []) });
/** Bounded player count and authored movement speed. */
export const AuthorCapsSchema = v.strictObject({ players: v.pipe(positive, v.maxValue(32)), speed: v.pipe(ShardFiniteSchema, v.minValue(0), v.maxValue(15)) });
/** Bounded authoritative simulation resource declarations. */
export const ServerBudgetSchema = v.strictObject({ tickMicros: v.pipe(positive, v.maxValue(16_666)), memory: positive, entities: v.pipe(ShardNaturalSchema, v.maxValue(10_000)), commandsPerTick: v.pipe(ShardNaturalSchema, v.maxValue(1024)) });
/** Content-addressed file inventory and conservative costs. */
export const FilesSchema = v.pipe(v.array(file), v.maxLength(limits.files));
/** Finite L0/L1 tile inventory. */
export const TilesSchema = v.pipe(v.array(tile), v.maxLength(tileCount));
/** Ordered admitted library roots. */
export const LibrarySchema = ShardReferencesSchema;
/** Ordered admitted critical roots. */
export const CriticalSchema = ShardReferencesSchema;
/** Nullable far proxy references, bounds and conservative costs. */
export const FarSchema = v.nullable(v.strictObject({ files: ShardReferencesSchema, bounds: CellBoundsSchema, ...costs }));
/** Finite local player position and yaw; its default remains in root composition. */
export const SpawnSchema = v.strictObject({ x: ShardFiniteSchema, y: ShardFiniteSchema, z: ShardFiniteSchema, yaw: ShardFiniteSchema });
