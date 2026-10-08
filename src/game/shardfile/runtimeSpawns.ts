import * as v from 'valibot';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const kind = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*$/u), v.maxLength(64));
const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const at = v.tuple([coord, coord]);
/** One home: a creature of the runtime's own species, placed at `at` (x, z), refilled `respawn` seconds after it falls. */
const home = v.strictObject({ id, kind, look: id, at, yaw: finite, respawn: v.pipe(finite, v.minValue(1), v.maxValue(3600)) });
/** One boss body: spawned and retired by the runtime's encounter script (a retry spawns a fresh body under the same id). */
const boss = v.strictObject({ id, kind, look: id, at, yaw: finite });

/**
 * A trusted hybrid runtime's creatures as declared rows (SHARD-PLATFORM M3 / SF50-p, E435), the `spawns` section of
 * `runtime.binds`. The runtime keeps its own species (rigs, brains, the hard 20 %); the rows declare WHERE they live and
 * WHO they are: each row's `id` is its stable declared key (a retained home uses it across respawn and cold restore).
 * One-shot actors keep their runtime-allocated identities and spawn order; `kind` / `look` name the runtime's registered
 * species and variant, and a home's `respawn` its refill delay.
 * The platform keeps the homes (`bindRuntimeHomes`, `bindRuntimeBoss` in ./hybridRows.ts); this is not the local sim's
 * `creatures` section (no brain, strike or species-catalogue rows: those stay the runtime's).
 */
export const RuntimeSpawnsSchema = v.pipe(v.strictObject({ homes: v.pipe(v.array(home), v.maxLength(256)), bosses: v.pipe(v.array(boss), v.maxLength(16)),
  actors: v.exactOptional(v.pipe(v.array(boss), v.maxLength(256))) }), v.check((rows) => {
  const ids = [...rows.homes, ...rows.bosses, ...(rows.actors ?? [])].map((row) => row.id);
  return new Set(ids).size === ids.length;
}, 'unique runtime spawn identities'));
/** Validated runtime-bound homes, boss bodies and optional one-shot actors; admission never changes row order. */
export type RuntimeSpawns = v.InferOutput<typeof RuntimeSpawnsSchema>;
/** One declared home row. */
export type RuntimeHomeRow = RuntimeSpawns['homes'][number];
/** One declared boss row. */
export type RuntimeBossRow = RuntimeSpawns['bosses'][number];
/** One declared finite one-shot body; the runtime keeps its ordinary spawn order and allocated identity, with no refill. */
export type RuntimeActorRow = NonNullable<RuntimeSpawns['actors']>[number];
/** Validate runtime spawn rows at the author boundary. */
export function parseRuntimeSpawns(input: unknown): RuntimeSpawns { return v.parse(RuntimeSpawnsSchema, input); }
