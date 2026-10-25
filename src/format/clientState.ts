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
export const ItemCheckpointStatesSchema: v.GenericSchema<ItemCheckpointStatesInput, ItemCheckpointStates> = v.record(name, item);
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
const legacyCheckpoint: v.GenericSchema<LegacyClientCheckpointInput, LegacyClientCheckpoint> = v.strictObject({ version: v.literal(1), ...fields });
/** Revision-independent version-two local progress with the admitted logical state. */
export const LogicalClientCheckpointSchema: v.GenericSchema<LogicalClientCheckpointInput, LogicalClientCheckpoint> = v.strictObject({ version: v.literal(2), shard: name, state: LogicalStateSchema, ...fields });
/** Versioned local progress accepted independently of a regional engine snapshot. */
export const ClientCheckpointSchema: v.GenericSchema<ClientCheckpointInput, ClientCheckpoint> = v.union([legacyCheckpoint, LogicalClientCheckpointSchema]);
/** Portable declared progress plus the exact-revision fast path; old payloads stay readable. */


/** Admitted data contracts, independent of validator implementation metadata. */
export type ItemCheckpointStatesInput = ItemCheckpointStates;
export type ItemCheckpointStates = Record<string, {
    version: 1;
    id: string;
    tick: number;
    cooldown: number;
    fuel: number;
    lit: boolean;
    held: boolean;
    chargeTime: number;
    pending: ({
        action: 1 | 2 | 3 | 4;
        aim: ({
            origin: {
                x: number;
                y: number;
                z: number;
            };
            direction: {
                x: number;
                y: number;
                z: number;
            };
        }) | null;
    })[];
}>;
export type LegacyClientCheckpointInput = Omit<{
    version: 1;
}, keyof ({
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStatesInput;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferInput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
})> & {
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStatesInput;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferInput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
};
export type LegacyClientCheckpoint = Omit<{
    version: 1;
}, keyof ({
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStates;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferOutput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
})> & {
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStates;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferOutput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
};
export type LogicalClientCheckpointInput = Omit<{
    version: 2;
    shard: string;
    state: v.InferInput<typeof LogicalStateSchema>;
}, keyof ({
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStatesInput;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferInput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
})> & {
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStatesInput;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferInput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
};
export type LogicalClientCheckpoint = Omit<{
    version: 2;
    shard: string;
    state: v.InferOutput<typeof LogicalStateSchema>;
}, keyof ({
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStates;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferOutput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
})> & {
    revision: number;
    tick: number;
    lane: (string) | null;
    items: ItemCheckpointStates;
    flags: (string)[];
    quests: ({
        version: 1;
        id: string;
        started: boolean;
        currentId: (string) | null;
    })[];
    dialogue: Record<string, (string) | null>;
    health?: Record<string, {
        hp: number;
        maxHp: number;
        alive: boolean;
    }> | undefined;
    props?: Record<string, boolean> | undefined;
    liftRider?: v.InferOutput<typeof LiftRiderSchema> | undefined;
    moverPending?: ([
        string,
        1 | 2 | 3
    ])[] | undefined;
};
export type ClientCheckpointInput = (LegacyClientCheckpointInput) | (LogicalClientCheckpointInput);
export type ClientCheckpoint = (LegacyClientCheckpoint) | (LogicalClientCheckpoint);
