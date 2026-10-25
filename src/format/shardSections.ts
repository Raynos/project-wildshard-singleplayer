/** Defining root wire sections shared by the authoring SDK and game admission.
 * Native reference/asset/entry/allocator checks stay in game; look and material contracts await DS1.4. */
import * as v from 'valibot';
import { WIRE_CELL, WIRE_TILE_SIZES } from './wireLimits';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { SHARDFILE_VERSION } from './version';
import { RuntimeCostSchema } from './runtimeCost';
import { CommonsCostsSchema } from './commonsCosts';
import { ScriptBindingsSchema } from './scripts';

const CHUNK_HALF = WIRE_CELL.half, CELL_BELOW = WIRE_CELL.below, CELL_ABOVE = WIRE_CELL.above;
/** Nonnegative safe wire integer. */
export const ShardNaturalSchema: v.GenericSchema<ShardNaturalInput, ShardNatural> = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(ShardNaturalSchema, v.minValue(1));
/** Finite wire number without an imposed gameplay range. */
export const ShardFiniteSchema: v.GenericSchema<ShardFiniteInput, ShardFinite> = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(limits.idCharacters));
/** Local SHA256 content identity. */
export const ShardHashSchema: v.GenericSchema<ShardHashInput, ShardHash> = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Local or commons-qualified SHA256 content reference. */
export const ShardReferenceSchema: v.GenericSchema<ShardReferenceInput, ShardReference> = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
/** Bounded ordered references to local or commons content. */
export const ShardReferencesSchema: v.GenericSchema<ShardReferencesInput, ShardReferences> = v.pipe(v.array(ShardReferenceSchema), v.maxLength(limits.files + limits.commons));
/** Bounded ordered names in a root declaration. */
export const ShardNamesSchema: v.GenericSchema<ShardNamesInput, ShardNames> = v.pipe(v.array(name), v.maxLength(limits.files));
const vec3 = v.tuple([ShardFiniteSchema, ShardFiniteSchema, ShardFiniteSchema]);
/** Ordered local bounds inside the fixed shard cell. */
export const CellBoundsSchema: v.GenericSchema<CellBoundsInput, CellBounds> = v.pipe(v.strictObject({ min: vec3, max: vec3 }), v.check((b) => b.min.every((n, i) => n <= (b.max[i] ?? -Infinity)), 'ordered bounds'), v.check((b) => b.min[0] >= -CHUNK_HALF && b.max[0] <= CHUNK_HALF && b.min[2] >= -CHUNK_HALF && b.max[2] <= CHUNK_HALF && b.min[1] >= -CELL_BELOW && b.max[1] <= CELL_ABOVE, 'cell bounds'));
const drawBounds = CellBoundsSchema;
const costs = { compressed: ShardNaturalSchema, decoded: ShardNaturalSchema, gpu: ShardNaturalSchema, triangles: ShardNaturalSchema, draws: ShardNaturalSchema };
const tile: v.GenericSchema<ShardTileRowsInput, ShardTileRows> = v.strictObject({ lod: v.picklist([0, 1]), x: ShardNaturalSchema, z: ShardNaturalSchema, bounds: CellBoundsSchema, drawBounds: v.exactOptional(drawBounds), geometricError: v.pipe(ShardFiniteSchema, v.minValue(0)), files: ShardReferencesSchema, ...costs });
const file: v.StrictObjectSchema<{ readonly hash: v.GenericSchema<ShardFileRowsInput['hash'], ShardFileRows['hash']>; readonly kind: v.GenericSchema<ShardFileRowsInput['kind'], ShardFileRows['kind']>; readonly compressed: v.GenericSchema<ShardFileRowsInput['compressed'], ShardFileRows['compressed']>; readonly decoded: v.GenericSchema<ShardFileRowsInput['decoded'], ShardFileRows['decoded']>; readonly gpu: v.GenericSchema<ShardFileRowsInput['gpu'], ShardFileRows['gpu']>; readonly triangles: v.GenericSchema<ShardFileRowsInput['triangles'], ShardFileRows['triangles']>; readonly draws: v.GenericSchema<ShardFileRowsInput['draws'], ShardFileRows['draws']>; readonly dependencies: v.GenericSchema<ShardFileRowsInput['dependencies'], ShardFileRows['dependencies']>; readonly critical: v.GenericSchema<ShardFileRowsInput['critical'], ShardFileRows['critical']>; }, undefined> = v.strictObject({ hash: ShardHashSchema, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'binary', 'image']), ...costs, dependencies: ShardReferencesSchema, critical: v.boolean() });
const tileCount = (2 * CHUNK_HALF / WIRE_TILE_SIZES.l0) ** 2 + (2 * CHUNK_HALF / WIRE_TILE_SIZES.l1) ** 2;

/** Stable authored shard identity and deterministic seed. */
export const IdentitySchema: v.GenericSchema<ShardIdentityInput, ShardIdentity> = v.strictObject({ slug: name, name: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), author: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), revision: positive, seed: ShardNaturalSchema });
/** Wire revision, capabilities and exact commons declarations. */
export const RequiresSchema: v.GenericSchema<ShardRequiresInput, ShardRequires> = v.strictObject({ sdk: v.literal(SHARDFILE_VERSION), capabilities: ShardNamesSchema, commons: v.pipe(v.array(ShardHashSchema), v.maxLength(limits.commons)), commonsWire: v.optional(v.record(ShardHashSchema, ShardNaturalSchema), {}), commonsCosts: v.optional(CommonsCostsSchema, {}) });
/** Authored compressed and resident ceilings. */
export const BudgetsSchema: v.GenericSchema<ShardBudgetsInput, ShardBudgets> = v.strictObject({
  /** Reviewed whole-client floor retained when an opaque runtime becomes declared data. */
  client: v.exactOptional(RuntimeCostSchema), library: v.strictObject({ resident: ShardNaturalSchema, compressed: ShardNaturalSchema, downloadAllowance: v.exactOptional(ShardNaturalSchema) }), sim: v.strictObject({ resident: ShardNaturalSchema, compressed: ShardNaturalSchema }), overlap: ShardNaturalSchema });
/** Fixed-step simulation and admitted script binding declarations. */
export const SimSchema: v.GenericSchema<ShardSimInput, ShardSim> = v.strictObject({ fixedHz: v.literal(60), scriptTickDivisor: v.pipe(positive, v.check((n) => 60 % n === 0, 'script divisor divides 60')), commandVersion: v.literal(0), snapshotVersion: v.literal(0), scripts: ShardReferencesSchema, bindings: v.optional(ScriptBindingsSchema, []) });
/** Bounded player count and authored movement speed. */
export const AuthorCapsSchema: v.GenericSchema<ShardAuthorCapsInput, ShardAuthorCaps> = v.strictObject({ players: v.pipe(positive, v.maxValue(32)), speed: v.pipe(ShardFiniteSchema, v.minValue(0), v.maxValue(15)) });
/** Bounded authoritative simulation resource declarations. */
export const ServerBudgetSchema: v.GenericSchema<ShardServerBudgetInput, ShardServerBudget> = v.strictObject({ tickMicros: v.pipe(positive, v.maxValue(16_666)), memory: positive, entities: v.pipe(ShardNaturalSchema, v.maxValue(10_000)), commandsPerTick: v.pipe(ShardNaturalSchema, v.maxValue(1024)) });
/** Content-addressed file inventory and conservative costs. */
export const FilesSchema: v.GenericSchema<ShardFilesInput, ShardFiles> & { readonly pipe: readonly [v.ArraySchema<typeof file, undefined>, unknown] } = v.pipe(v.array(file), v.maxLength(limits.files));
/** Finite L0/L1 tile inventory. */
export const TilesSchema: v.GenericSchema<ShardTilesInput, ShardTiles> = v.pipe(v.array(tile), v.maxLength(tileCount));
/** Ordered admitted library roots. */
export const LibrarySchema: typeof ShardReferencesSchema = ShardReferencesSchema;
/** Ordered admitted critical roots. */
export const CriticalSchema: typeof ShardReferencesSchema = ShardReferencesSchema;
/**
 * G539: the far tier's camera-facing impostor, baked with the proxy (`@wildshard/sdk/bake/farImpostor`): `views` renders
 * round the cell (view k seen from compass azimuth k × 360° / views), `cols` × rows tiles of `tile` pixels in one image
 * file, each tile `width` metres wide about the cell centre and spanning `bottom` … `top` metres; texels hold the lit
 * colour sRGB-encoded over `range` (linear = decoded × range) and a 1-bit coverage alpha. Its costs are in the far row's.
 */
export const FarImpostorSchema: v.GenericSchema<FarImpostorInput, FarImpostor> = v.strictObject({
  file: ShardReferenceSchema, views: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)), cols: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)),
  tile: v.tuple([v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(1024)), v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(1024))]),
  width: v.pipe(ShardFiniteSchema, v.minValue(1), v.maxValue(4 * CHUNK_HALF)), bottom: v.pipe(ShardFiniteSchema, v.minValue(-CELL_BELOW)), top: v.pipe(ShardFiniteSchema, v.maxValue(CELL_ABOVE)),
  range: v.pipe(ShardFiniteSchema, v.minValue(0.01), v.maxValue(16)),
});
/** One far impostor row. */

/** Nullable far proxy references, bounds and conservative costs (its impostor's file is one of `files`). */
export const FarSchema: v.GenericSchema<ShardFarInput, ShardFar> = v.nullable(v.pipe(v.strictObject({ files: ShardReferencesSchema, bounds: CellBoundsSchema, impostor: v.exactOptional(FarImpostorSchema), ...costs }),
  v.check((far) => far.impostor === undefined || (far.files.includes(far.impostor.file) && far.impostor.bottom < far.impostor.top), 'far impostor file and span')));
/** Finite local player position and yaw; its default remains in root composition. */
export const SpawnSchema: v.GenericSchema<ShardSpawnInput, ShardSpawn> = v.strictObject({ x: ShardFiniteSchema, y: ShardFiniteSchema, z: ShardFiniteSchema, yaw: ShardFiniteSchema });

/** Admitted data contracts, independent of validator implementation metadata. */
export type ShardNaturalInput = ShardNatural;
export type ShardNatural = number;
export type ShardFiniteInput = ShardFinite;
export type ShardFinite = number;
export type ShardHashInput = ShardHash;
export type ShardHash = string;
export type ShardReferenceInput = ShardReference;
export type ShardReference = string;
export type ShardReferencesInput = (ShardReferenceInput)[];
export type ShardReferences = (ShardReference)[];
export type ShardNamesInput = ShardNames;
export type ShardNames = (string)[];
interface CellBoundsInputFields {
    min: [
        ShardFiniteInput,
        ShardFiniteInput,
        ShardFiniteInput
    ];
    max: [
        ShardFiniteInput,
        ShardFiniteInput,
        ShardFiniteInput
    ];
}
export type CellBoundsInput = { [Key in keyof CellBoundsInputFields]: CellBoundsInputFields[Key] };
interface CellBoundsFields {
    min: [
        ShardFinite,
        ShardFinite,
        ShardFinite
    ];
    max: [
        ShardFinite,
        ShardFinite,
        ShardFinite
    ];
}
export type CellBounds = { [Key in keyof CellBoundsFields]: CellBoundsFields[Key] };
export type ShardTileRowsInput = Omit<{
    lod: 0 | 1;
    x: ShardNaturalInput;
    z: ShardNaturalInput;
    bounds: CellBoundsInput;
    drawBounds?: CellBoundsInput;
    geometricError: ShardFiniteInput;
    files: ShardReferencesInput;
}, keyof ({
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
})> & {
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
};
export type ShardTileRows = Omit<{
    lod: 0 | 1;
    x: ShardNatural;
    z: ShardNatural;
    bounds: CellBounds;
    drawBounds?: CellBounds;
    geometricError: ShardFinite;
    files: ShardReferences;
}, keyof ({
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
})> & {
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
};
export type ShardFileRowsInput = Omit<Omit<{
    hash: ShardHashInput;
    kind: 'glb' | 'ktx2' | 'audio' | 'json' | 'wasm' | 'binary' | 'image';
}, keyof ({
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
})> & {
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
}, keyof ({
    dependencies: ShardReferencesInput;
    critical: boolean;
})> & {
    dependencies: ShardReferencesInput;
    critical: boolean;
};
export type ShardFileRows = Omit<Omit<{
    hash: ShardHash;
    kind: 'glb' | 'ktx2' | 'audio' | 'json' | 'wasm' | 'binary' | 'image';
}, keyof ({
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
})> & {
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
}, keyof ({
    dependencies: ShardReferences;
    critical: boolean;
})> & {
    dependencies: ShardReferences;
    critical: boolean;
};
interface ShardIdentityInputFields {
    slug: string;
    name: string;
    author: string;
    revision: ShardNaturalInput;
    seed: ShardNaturalInput;
}
export type ShardIdentityInput = { [Key in keyof ShardIdentityInputFields]: ShardIdentityInputFields[Key] };
interface ShardIdentityFields {
    slug: string;
    name: string;
    author: string;
    revision: ShardNatural;
    seed: ShardNatural;
}
export type ShardIdentity = { [Key in keyof ShardIdentityFields]: ShardIdentityFields[Key] };
interface ShardRequiresInputFields {
    sdk: (typeof SHARDFILE_VERSION);
    capabilities: ShardNamesInput;
    commons: (ShardHashInput)[];
    commonsWire?: Record<string, ShardNaturalInput> | undefined;
    commonsCosts?: v.InferInput<typeof CommonsCostsSchema> | undefined;
}
export type ShardRequiresInput = { [Key in keyof ShardRequiresInputFields]: ShardRequiresInputFields[Key] };
interface ShardRequiresFields {
    sdk: (typeof SHARDFILE_VERSION);
    capabilities: ShardNames;
    commons: (ShardHash)[];
    commonsWire: Record<string, ShardNatural>;
    commonsCosts: v.InferOutput<typeof CommonsCostsSchema>;
}
export type ShardRequires = { [Key in keyof ShardRequiresFields]: ShardRequiresFields[Key] };
interface ShardBudgetsInputFields {
    client?: v.InferInput<typeof RuntimeCostSchema>;
    library: {
        resident: ShardNaturalInput;
        compressed: ShardNaturalInput;
        downloadAllowance?: ShardNaturalInput;
    };
    sim: {
        resident: ShardNaturalInput;
        compressed: ShardNaturalInput;
    };
    overlap: ShardNaturalInput;
}
export type ShardBudgetsInput = { [Key in keyof ShardBudgetsInputFields]: ShardBudgetsInputFields[Key] };
interface ShardBudgetsFields {
    client?: v.InferOutput<typeof RuntimeCostSchema>;
    library: {
        resident: ShardNatural;
        compressed: ShardNatural;
        downloadAllowance?: ShardNatural;
    };
    sim: {
        resident: ShardNatural;
        compressed: ShardNatural;
    };
    overlap: ShardNatural;
}
export type ShardBudgets = { [Key in keyof ShardBudgetsFields]: ShardBudgetsFields[Key] };
interface ShardSimInputFields {
    fixedHz: 60;
    scriptTickDivisor: ShardNaturalInput;
    commandVersion: 0;
    snapshotVersion: 0;
    scripts: ShardReferencesInput;
    bindings?: v.InferInput<typeof ScriptBindingsSchema> | undefined;
}
export type ShardSimInput = { [Key in keyof ShardSimInputFields]: ShardSimInputFields[Key] };
interface ShardSimFields {
    fixedHz: 60;
    scriptTickDivisor: ShardNatural;
    commandVersion: 0;
    snapshotVersion: 0;
    scripts: ShardReferences;
    bindings: v.InferOutput<typeof ScriptBindingsSchema>;
}
export type ShardSim = { [Key in keyof ShardSimFields]: ShardSimFields[Key] };
interface ShardAuthorCapsInputFields {
    players: ShardNaturalInput;
    speed: ShardFiniteInput;
}
export type ShardAuthorCapsInput = { [Key in keyof ShardAuthorCapsInputFields]: ShardAuthorCapsInputFields[Key] };
interface ShardAuthorCapsFields {
    players: ShardNatural;
    speed: ShardFinite;
}
export type ShardAuthorCaps = { [Key in keyof ShardAuthorCapsFields]: ShardAuthorCapsFields[Key] };
interface ShardServerBudgetInputFields {
    tickMicros: ShardNaturalInput;
    memory: ShardNaturalInput;
    entities: ShardNaturalInput;
    commandsPerTick: ShardNaturalInput;
}
export type ShardServerBudgetInput = { [Key in keyof ShardServerBudgetInputFields]: ShardServerBudgetInputFields[Key] };
interface ShardServerBudgetFields {
    tickMicros: ShardNatural;
    memory: ShardNatural;
    entities: ShardNatural;
    commandsPerTick: ShardNatural;
}
export type ShardServerBudget = { [Key in keyof ShardServerBudgetFields]: ShardServerBudgetFields[Key] };
export type ShardFilesInput = (ShardFileRowsInput)[];
export type ShardFiles = (ShardFileRows)[];
export type ShardTilesInput = (ShardTileRowsInput)[];
export type ShardTiles = (ShardTileRows)[];
interface FarImpostorInputFields {
    file: ShardReferenceInput;
    views: number;
    cols: number;
    tile: [
        number,
        number
    ];
    width: ShardFiniteInput;
    bottom: ShardFiniteInput;
    top: ShardFiniteInput;
    range: ShardFiniteInput;
}
export type FarImpostorInput = { [Key in keyof FarImpostorInputFields]: FarImpostorInputFields[Key] };
interface FarImpostorFields {
    file: ShardReference;
    views: number;
    cols: number;
    tile: [
        number,
        number
    ];
    width: ShardFinite;
    bottom: ShardFinite;
    top: ShardFinite;
    range: ShardFinite;
}
export type FarImpostor = { [Key in keyof FarImpostorFields]: FarImpostorFields[Key] };
export type ShardFarInput = (Omit<{
    files: ShardReferencesInput;
    bounds: CellBoundsInput;
    impostor?: FarImpostorInput;
}, keyof ({
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
})> & {
    compressed: ShardNaturalInput;
    decoded: ShardNaturalInput;
    gpu: ShardNaturalInput;
    triangles: ShardNaturalInput;
    draws: ShardNaturalInput;
}) | null;
export type ShardFar = (Omit<{
    files: ShardReferences;
    bounds: CellBounds;
    impostor?: FarImpostor;
}, keyof ({
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
})> & {
    compressed: ShardNatural;
    decoded: ShardNatural;
    gpu: ShardNatural;
    triangles: ShardNatural;
    draws: ShardNatural;
}) | null;
interface ShardSpawnInputFields {
    x: ShardFiniteInput;
    y: ShardFiniteInput;
    z: ShardFiniteInput;
    yaw: ShardFiniteInput;
}
export type ShardSpawnInput = { [Key in keyof ShardSpawnInputFields]: ShardSpawnInputFields[Key] };
interface ShardSpawnFields {
    x: ShardFinite;
    y: ShardFinite;
    z: ShardFinite;
    yaw: ShardFinite;
}
export type ShardSpawn = { [Key in keyof ShardSpawnFields]: ShardSpawnFields[Key] };
