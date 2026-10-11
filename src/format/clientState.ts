import * as v from 'valibot';
import { LogicalStateSchema } from './migrations';
import { LiftRiderSchema } from './liftRider';

const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const hitPoints = v.pipe(finite, v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const name = v.pipe(v.string(), v.maxLength(256));
const vector = v.strictObject({ x: finite, y: finite, z: finite });
const item = v.strictObject({ version: v.literal(1), id: name,
  tick: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)),
  cooldown: v.pipe(finite, v.minValue(0)), fuel: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  lit: v.boolean(), held: v.boolean(), chargeTime: v.pipe(finite, v.minValue(0)),
  pending: v.pipe(v.array(v.strictObject({ action: v.picklist([1, 2, 3, 4]), aim: v.nullable(v.strictObject({ origin: vector, direction: vector })) })), v.maxLength(16)),
});
/** Bounded pending input and cooldown state for every declared item. */
export const ItemCheckpointStatesSchema = v.record(name, item);
const fields = { revision: natural, tick: natural,
  lane: v.nullable(v.pipe(v.string(), v.maxLength(32 * 1024 * 1024))), items: ItemCheckpointStatesSchema,
  flags: v.pipe(v.array(name), v.maxLength(4096)),
  quests: v.pipe(v.array(v.strictObject({ version: v.literal(1), id: name, started: v.boolean(), currentId: v.nullable(name) })), v.maxLength(256)),
  dialogue: v.record(name, v.nullable(name)),
  health: v.optional(v.pipe(v.record(name, v.pipe(v.strictObject({ hp: hitPoints, maxHp: v.pipe(hitPoints, v.minValue(Number.MIN_VALUE)), alive: v.boolean() }),
    v.check((row) => row.hp <= row.maxHp && row.alive === (row.hp > 0), 'Consistent creature health'))), v.check((rows) => Object.keys(rows).length <= 10000))),
  props: v.optional(v.record(name, v.boolean())),
  liftRider: v.optional(LiftRiderSchema),
  moverPending: v.optional(v.pipe(v.array(v.tuple([name, v.picklist([1, 2, 3])])), v.maxLength(32))),
};
const legacyCheckpoint = v.strictObject({ version: v.literal(1), ...fields });
/** Revision-independent version-two local progress with the admitted logical state. */
export const LogicalClientCheckpointSchema = v.strictObject({ version: v.literal(2), shard: name, state: LogicalStateSchema, ...fields });
/** Versioned local progress accepted independently of a regional engine snapshot. */
export const ClientCheckpointSchema = v.union([legacyCheckpoint, LogicalClientCheckpointSchema]);
/** Portable declared progress plus the exact-revision fast path; old payloads stay readable. */
export type ClientCheckpoint = v.InferOutput<typeof ClientCheckpointSchema>;
