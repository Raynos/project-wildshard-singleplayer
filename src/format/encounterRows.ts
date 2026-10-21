/** Build-only admission for existing encounter rows; play imports types only. */
import * as v from 'valibot';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';

const finite=v.pipe(v.number(),v.finite()),numbers=v.record(v.string(),finite);
const count=v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(64));
const offset=v.pipe(finite,v.integer(),v.minValue(-1),v.maxValue(1)),numeric=numbers;
const pair=v.tuple([finite,finite]);
export const EncounterPatrolSchema = v.strictObject({
  parameters: numbers, member: numbers, group: numbers,
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), leader: v.string(), count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
    herd: finite, player: v.strictObject({ x: v.string(), z: v.string() }),
    target: v.strictObject({ x: v.string(), z: v.string() }), steering: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ cycle: v.string(), empty: v.string(), dissolve: v.string(),
    member: v.string(), fire: v.string(), retry: v.string(), start: v.string(), slot: v.string(), group: v.string(), target: v.string() }),
});
export const EncounterSlotsSchema = v.strictObject({
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), variants: v.record(v.string(), v.string()), herd: finite, yaw: finite, sink: finite,
    memory: numbers, home: v.strictObject({ x: v.string(), z: v.string(), yaw: v.string() }), dawn: v.string(), gone: v.string() })),
  release: v.string(),
  cycle: v.strictObject({ signal: v.string(), initial: numbers }),
  member: v.strictObject({ signal: v.string(), initial: numbers }),
  select: v.strictObject({ signal: v.string(), count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(8)) }),
});
export const CoupledEncounterRowsSchema = v.strictObject({ initial: numbers, member: numbers, commit: numbers, parameters: numbers,
  actors: v.optional(v.strictObject({ hp: v.pipe(finite, v.minValue(1)), memory: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ couple: v.string(), member: v.string(), damage: v.string() }) });
export const EncounterScheduleSchema = v.strictObject({ signal: v.string(), initial: numbers, parameters: numbers, retain: v.record(v.string(), v.string()) });
export const ArenaFieldSchema = v.strictObject({
  x: finite, z: finite, width: count, depth: count,
  cell: v.pipe(finite, v.minValue(.01)),
  observations: v.record(v.string(), finite),
  neighbours: v.pipe(v.array(v.tuple([offset, offset])), v.maxLength(8)),
  signals: v.strictObject({ ignite: v.string(), step: v.string(), clock: v.string() }),
  contact: v.optional(v.strictObject({ law: EncounterScheduleSchema,
    samples: v.pipe(v.array(v.strictObject({ x: finite, z: finite })), v.maxLength(8)) })),
});
const schedule = v.strictObject({ id: v.string(), law: EncounterScheduleSchema });
/** A bounded set of authored clocks. The AS gate chooses which clocks advance;
 * projections observe shared health/phase inputs and publish one-shot effects.
 * Landing slots borrow a position history; no view or shard callback is stored. */
export const ArenaEncounterSchema = v.strictObject({
  gate: v.strictObject({ signal: v.string(), parameters: numeric }),
  schedules: v.pipe(v.array(schedule), v.maxLength(16)),
  shared: v.record(v.string(), v.strictObject({ clock: v.string(), slot: v.string() })),
  volley: v.strictObject({ launcher: v.string(), capacity: v.pipe(count, v.maxValue(8)),
    landing: EncounterScheduleSchema, trail: v.strictObject({ capacity: count, seconds: v.pipe(finite, v.minValue(.1)) }) }),
});
export const ArenaWhirlsSchema = v.strictObject({
 laws: v.pipe(v.array(EncounterScheduleSchema), v.minLength(1), v.maxLength(8)), ease: finite, spin: finite, sink: finite, breathe: pair,
 debris: v.strictObject({ count: v.pipe(count, v.maxValue(64)), climb: finite, turn: finite, step: finite, radius: pair, height: finite,
  axis: v.tuple([finite, finite, finite]), roll: finite, scale: v.tuple([finite, finite, v.pipe(count, v.maxValue(16))]) }),
});
/** Existing timed named file; unrelated source binding fields remain intact. */
export const TimedEncountersSchema = v.looseObject({ presentation: v.string(), program: ReturnProgramSchema, slots: EncounterSlotsSchema, view: v.unknown(),
  patrol: EncounterPatrolSchema, motion: EncounterScheduleSchema, ride: v.unknown(), phases: v.strictObject({ slots: v.array(v.string()), patrol: v.array(v.string()) }),
  lightFloor: v.pipe(v.number(), v.finite(), v.minValue(0)),
  contact: v.strictObject({ strike: CreatureStrikeSchema, tags: v.array(CreatureStrikeSchema.entries.tags.pipe[0].item), origin: v.picklist(['actor', 'player']) }),
});

export type EncounterPatrolRows=v.InferOutput<typeof EncounterPatrolSchema>;
export type EncounterSlotsRows=v.InferOutput<typeof EncounterSlotsSchema>;
export type CoupledEncounterRows=v.InferOutput<typeof CoupledEncounterRowsSchema>;
export type ArenaFieldRows=v.InferOutput<typeof ArenaFieldSchema>;
export type ArenaEncounterRows=v.InferOutput<typeof ArenaEncounterSchema>;
export type ArenaWhirlsRows=v.InferOutput<typeof ArenaWhirlsSchema>;
export type TimedEncountersRows=v.InferOutput<typeof TimedEncountersSchema>;
export type EncounterScheduleRows=v.InferOutput<typeof EncounterScheduleSchema>;
