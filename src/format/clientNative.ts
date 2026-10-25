import * as v from 'valibot';
import { PersistedQuestPageSchema } from './questStory';
import { MarkedBossPresentationSchema } from './bossProfiles';

const finite = v.pipe(v.number(), v.finite());
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(4096));
const ids = v.pipe(v.array(id), v.maxLength(1024), v.check(rows => new Set(rows).size === rows.length, 'Unique owner ids'));
const home = v.strictObject({ x: finite, y: finite, z: finite, r: v.pipe(finite, v.minValue(Number.MIN_VALUE)) });
const capture = v.union([
  v.strictObject({ flag: id }), v.strictObject({ action: id }),
  v.strictObject({ finish: v.literal(true) }), v.strictObject({ settle: v.literal('weather.fields') }),
  v.strictObject({ mover: id, command: v.picklist([1, 2, 3]) }),
]);
/** Staged native player view policy and the existing declared wind-column law. */
export const ClientPlayerEnterSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientPlayerEnterRowsInput['kind'], ClientPlayerEnterRows['kind']>; readonly pitch: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientPlayerEnterRowsInput['pitch'], undefined>, Exclude<ClientPlayerEnterRows['pitch'], undefined>>, undefined>; readonly bounds: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientPlayerEnterRowsInput['bounds'], undefined>, Exclude<ClientPlayerEnterRows['bounds'], undefined>>, undefined>; readonly columns: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientPlayerEnterRowsInput['columns'], undefined>, Exclude<ClientPlayerEnterRows['columns'], undefined>>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('player.enter'),
  pitch: v.exactOptional(v.pipe(finite, v.minValue(-Math.PI / 2), v.maxValue(Math.PI / 2))),
  bounds: v.exactOptional(v.pipe(v.strictObject({ x0: finite, x1: finite, z0: finite, z1: finite, floor: finite }),
    v.check(row => row.x0 < row.x1 && row.z0 < row.z1, 'Ordered player bounds'))),
  columns: v.exactOptional(v.strictObject({ enabledMode: id })),
});
/** Existing held-controller installation; its recipe and resources come from
 * the same admitted model definition used by Explorer. */
export const ClientHeldMeleeSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientHeldMeleeRowsInput['kind'], ClientHeldMeleeRows['kind']>; readonly item: v.GenericSchema<ClientHeldMeleeRowsInput['item'], ClientHeldMeleeRows['item']>; readonly stage: v.GenericSchema<ClientHeldMeleeRowsInput['stage'], ClientHeldMeleeRows['stage']>; readonly targets: v.GenericSchema<ClientHeldMeleeRowsInput['targets'], ClientHeldMeleeRows['targets']>; readonly composed: v.OptionalSchema<v.GenericSchema<Exclude<ClientHeldMeleeRowsInput['composed'], undefined>, Exclude<ClientHeldMeleeRows['composed'], undefined>>, false>; readonly stowedMode: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientHeldMeleeRowsInput['stowedMode'], undefined>, Exclude<ClientHeldMeleeRows['stowedMode'], undefined>>, undefined>; readonly finish: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientHeldMeleeRowsInput['finish'], undefined>, Exclude<ClientHeldMeleeRows['finish'], undefined>>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('held.melee'), item: id,
  stage: v.picklist(['kit', 'equipment']), targets: v.picklist(['scan', 'raycast']),
  composed: v.optional(v.boolean(), false), stowedMode: v.exactOptional(id),
  finish: v.exactOptional(v.strictObject({ part: id, look: id, image: id, library: id })),
});
/** The existing SpeciesBrains catalogue, with original registration order and
 * body homes. The program and rig rows are referenced, never copied here. */
export const ClientSpeciesProgramSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientSpeciesProgramRowsInput['kind'], ClientSpeciesProgramRows['kind']>; readonly library: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientSpeciesProgramRowsInput['library'], undefined>, Exclude<ClientSpeciesProgramRows['library'], undefined>>, undefined>; readonly catalogue: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientSpeciesProgramRowsInput['catalogue'], undefined>, Exclude<ClientSpeciesProgramRows['catalogue'], undefined>>, undefined>; readonly homes: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientSpeciesProgramRowsInput['homes'], undefined>, Exclude<ClientSpeciesProgramRows['homes'], undefined>>, undefined>; readonly shove: v.OptionalSchema<v.GenericSchema<Exclude<ClientSpeciesProgramRowsInput['shove'], undefined>, Exclude<ClientSpeciesProgramRows['shove'], undefined>>, false>; }, undefined>, v.CheckAction<{ [K in keyof ClientSpeciesProgramRows]: ClientSpeciesProgramRows[K] }, 'Species program requires one source'>]> = v.pipe(v.strictObject({ kind: v.literal('species.program'), library: v.exactOptional(id),
  catalogue: v.exactOptional(v.strictObject({ owner: id, actors: id, looks: id })),
  homes: v.exactOptional(v.pipe(v.record(id, home), v.maxEntries(256))), shove: v.optional(v.boolean(), false),
}), v.check(row => row.catalogue === undefined ? row.library !== undefined
  : row.library === undefined && row.homes === undefined && !row.shove, 'Species program requires one source'));
/** Saved page composition on the original flag/reward/NPC owners. Captures
 * select bounded platform actions, never a method or property path. */
export const ClientQuestPageSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientQuestPageRowsInput['kind'], ClientQuestPageRows['kind']>; readonly rows: v.GenericSchema<ClientQuestPageRowsInput['rows'], ClientQuestPageRows['rows']>; readonly progress: v.OptionalSchema<v.GenericSchema<Exclude<ClientQuestPageRowsInput['progress'], undefined>, Exclude<ClientQuestPageRows['progress'], undefined>>, false>; readonly promptOrder: v.GenericSchema<ClientQuestPageRowsInput['promptOrder'], ClientQuestPageRows['promptOrder']>; readonly endpoints: v.OptionalSchema<v.GenericSchema<Exclude<ClientQuestPageRowsInput['endpoints'], undefined>, Exclude<ClientQuestPageRows['endpoints'], undefined>>, readonly []>; readonly capture: v.OptionalSchema<v.GenericSchema<Exclude<ClientQuestPageRowsInput['capture'], undefined>, Exclude<ClientQuestPageRows['capture'], undefined>>, Record<never, never>>; }, undefined> = v.strictObject({ kind: v.literal('quest.page'),
  rows: v.omit(PersistedQuestPageSchema, ['capture']), progress: v.optional(v.boolean(), false),
  promptOrder: v.picklist(['page-npc', 'npc-page']),
  endpoints: v.optional(v.pipe(v.array(v.strictObject({ mover: id, stage: id, toast: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))) })), v.maxLength(64)), []),
  capture: v.optional(v.pipe(v.record(id, v.pipe(v.array(capture), v.maxLength(64))), v.maxEntries(64)), {}),
});
/** Native body allocation/refill policy; placement rows retain their original
 * identities in sim/runtime-plan rather than introducing a second roster. */
export const ClientPopulationSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientPopulationRowsInput['kind'], ClientPopulationRows['kind']>; readonly system: v.GenericSchema<ClientPopulationRowsInput['system'], ClientPopulationRows['system']>; readonly held: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientPopulationRowsInput['held'], undefined>, Exclude<ClientPopulationRows['held'], undefined>>, undefined>; readonly bodyHomes: v.OptionalSchema<v.GenericSchema<Exclude<ClientPopulationRowsInput['bodyHomes'], undefined>, Exclude<ClientPopulationRows['bodyHomes'], undefined>>, readonly []>; readonly holds: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientPopulationRowsInput['holds'], undefined>, Exclude<ClientPopulationRows['holds'], undefined>>, undefined>; readonly groups: v.OptionalSchema<v.GenericSchema<Exclude<ClientPopulationRowsInput['groups'], undefined>, Exclude<ClientPopulationRows['groups'], undefined>>, Record<never, never>>; readonly witness: v.GenericSchema<ClientPopulationRowsInput['witness'], ClientPopulationRows['witness']>; }, undefined> = v.strictObject({ kind: v.literal('population.homes'), system: id,
  held: v.exactOptional(v.strictObject({ order: ids, settle: id,
    placements: v.optional(v.pipe(v.array(v.strictObject({ id, fromY: finite, y: finite })), v.maxLength(1024)), []),
  })),
  bodyHomes: v.optional(v.pipe(v.array(v.strictObject({ id, home })), v.maxLength(1024)), []),
  holds: v.exactOptional(v.strictObject({ system: id, rows: v.pipe(v.array(v.strictObject({ home: count, field: id, until: id })), v.maxLength(1024)) })),
  groups: v.optional(v.pipe(v.record(id, ids), v.maxEntries(64)), {}),
  witness: v.union([v.strictObject({ groups: ids }), v.strictObject({ kinds: ids })]),
});
/** Browser presentation borrows the actual encounter definition, profile,
 * director and victory policy already admitted by sim/runtime-plan. */
const bossFight = { actor: id,
  armed: v.union([v.boolean(), v.strictObject({ flag: id })]),
  again: v.exactOptional(v.pipe(v.string(), v.maxLength(512))), rewardLabel: v.exactOptional(v.pipe(v.string(), v.maxLength(512))),
};
/** Existing marked arena views and lane-sheet tells share the actual encounter
 * owner. Numeric dimensions/paint remain authored client presentation. */
export const ClientBossTelegraphSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientBossTelegraphRowsInput['kind'], ClientBossTelegraphRows['kind']>; readonly actor: v.GenericSchema<ClientBossTelegraphRowsInput['actor'], ClientBossTelegraphRows['actor']>; readonly view: v.GenericSchema<ClientBossTelegraphRowsInput['view'], ClientBossTelegraphRows['view']>; }, undefined> = v.strictObject({ kind: v.literal('boss.telegraph'), actor: id,
  view: v.variant('kind', [v.strictObject({ kind: v.literal('marked'), rows: MarkedBossPresentationSchema }),
    v.strictObject({ kind: v.literal('lane-sheet'), strike: id, system: id,
      height: v.pipe(finite, v.minValue(Number.MIN_VALUE)), thickness: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
      y: finite, ahead: finite, opacity: v.tuple([finite, finite]), color: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffff)),
    })]),
});
export const ClientHeldBossSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientHeldBossRowsInput['kind'], ClientHeldBossRows['kind']>; readonly actor: v.GenericSchema<ClientHeldBossRowsInput['actor'], ClientHeldBossRows['actor']>; readonly armed: v.GenericSchema<ClientHeldBossRowsInput['armed'], ClientHeldBossRows['armed']>; readonly again: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientHeldBossRowsInput['again'], undefined>, Exclude<ClientHeldBossRows['again'], undefined>>, undefined>; readonly rewardLabel: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientHeldBossRowsInput['rewardLabel'], undefined>, Exclude<ClientHeldBossRows['rewardLabel'], undefined>>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('boss.held'), ...bossFight });
export const ClientSpawnedBossSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientSpawnedBossRowsInput['kind'], ClientSpawnedBossRows['kind']>; readonly actor: v.GenericSchema<ClientSpawnedBossRowsInput['actor'], ClientSpawnedBossRows['actor']>; readonly armed: v.GenericSchema<ClientSpawnedBossRowsInput['armed'], ClientSpawnedBossRows['armed']>; readonly again: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientSpawnedBossRowsInput['again'], undefined>, Exclude<ClientSpawnedBossRows['again'], undefined>>, undefined>; readonly rewardLabel: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientSpawnedBossRowsInput['rewardLabel'], undefined>, Exclude<ClientSpawnedBossRows['rewardLabel'], undefined>>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('boss.spawned'), ...bossFight });
export const ClientBossFightSchema: v.GenericSchema<ClientBossFightRowsInput, ClientBossFightRows> = v.variant('kind', [ClientHeldBossSchema, ClientSpawnedBossSchema]);

/** Admitted data contracts, independent of validator implementation metadata. */
export type ClientPlayerEnterRowsInput = ClientPlayerEnterRows;
interface ClientPlayerEnterRowsFields {
    kind: 'player.enter';
    pitch?: number;
    bounds?: {
        x0: number;
        x1: number;
        z0: number;
        z1: number;
        floor: number;
    };
    columns?: {
        enabledMode: string;
    };
}
export type ClientPlayerEnterRows = { [Key in keyof ClientPlayerEnterRowsFields]: ClientPlayerEnterRowsFields[Key] };
interface ClientHeldMeleeRowsInputFields {
    kind: 'held.melee';
    item: string;
    stage: 'kit' | 'equipment';
    targets: 'scan' | 'raycast';
    composed?: boolean | undefined;
    stowedMode?: string;
    finish?: {
        part: string;
        look: string;
        image: string;
        library: string;
    };
}
export type ClientHeldMeleeRowsInput = { [Key in keyof ClientHeldMeleeRowsInputFields]: ClientHeldMeleeRowsInputFields[Key] };
interface ClientHeldMeleeRowsFields {
    kind: 'held.melee';
    item: string;
    stage: 'kit' | 'equipment';
    targets: 'scan' | 'raycast';
    composed: boolean;
    stowedMode?: string;
    finish?: {
        part: string;
        look: string;
        image: string;
        library: string;
    };
}
export type ClientHeldMeleeRows = { [Key in keyof ClientHeldMeleeRowsFields]: ClientHeldMeleeRowsFields[Key] };
interface ClientSpeciesProgramRowsInputFields {
    kind: 'species.program';
    library?: string;
    catalogue?: {
        owner: string;
        actors: string;
        looks: string;
    };
    homes?: Record<string, {
        x: number;
        y: number;
        z: number;
        r: number;
    }>;
    shove?: boolean | undefined;
}
export type ClientSpeciesProgramRowsInput = { [Key in keyof ClientSpeciesProgramRowsInputFields]: ClientSpeciesProgramRowsInputFields[Key] };
interface ClientSpeciesProgramRowsFields {
    kind: 'species.program';
    library?: string;
    catalogue?: {
        owner: string;
        actors: string;
        looks: string;
    };
    homes?: Record<string, {
        x: number;
        y: number;
        z: number;
        r: number;
    }>;
    shove: boolean;
}
export type ClientSpeciesProgramRows = { [Key in keyof ClientSpeciesProgramRowsFields]: ClientSpeciesProgramRowsFields[Key] };
interface ClientQuestPageRowsInputFields {
    kind: 'quest.page';
    rows: Omit<v.InferInput<typeof PersistedQuestPageSchema>, 'capture'>;
    progress?: boolean | undefined;
    promptOrder: 'page-npc' | 'npc-page';
    endpoints?: ({
        mover: string;
        stage: string;
        toast?: string;
    })[] | undefined;
    capture?: Record<string, (({
        flag: string;
    }) | ({
        action: string;
    }) | ({
        finish: true;
    }) | ({
        settle: 'weather.fields';
    }) | ({
        mover: string;
        command: 1 | 2 | 3;
    }))[]> | undefined;
}
export type ClientQuestPageRowsInput = { [Key in keyof ClientQuestPageRowsInputFields]: ClientQuestPageRowsInputFields[Key] };
interface ClientQuestPageRowsFields {
    kind: 'quest.page';
    rows: Omit<v.InferOutput<typeof PersistedQuestPageSchema>, 'capture'>;
    progress: boolean;
    promptOrder: 'page-npc' | 'npc-page';
    endpoints: ({
        mover: string;
        stage: string;
        toast?: string;
    })[];
    capture: Record<string, (({
        flag: string;
    }) | ({
        action: string;
    }) | ({
        finish: true;
    }) | ({
        settle: 'weather.fields';
    }) | ({
        mover: string;
        command: 1 | 2 | 3;
    }))[]>;
}
export type ClientQuestPageRows = { [Key in keyof ClientQuestPageRowsFields]: ClientQuestPageRowsFields[Key] };
interface ClientPopulationRowsInputFields {
    kind: 'population.homes';
    system: string;
    held?: {
        order: (string)[];
        settle: string;
        placements?: ({
            id: string;
            fromY: number;
            y: number;
        })[] | undefined;
    };
    bodyHomes?: ({
        id: string;
        home: {
            x: number;
            y: number;
            z: number;
            r: number;
        };
    })[] | undefined;
    holds?: {
        system: string;
        rows: ({
            home: number;
            field: string;
            until: string;
        })[];
    };
    groups?: Record<string, (string)[]> | undefined;
    witness: ({
        groups: (string)[];
    }) | ({
        kinds: (string)[];
    });
}
export type ClientPopulationRowsInput = { [Key in keyof ClientPopulationRowsInputFields]: ClientPopulationRowsInputFields[Key] };
interface ClientPopulationRowsFields {
    kind: 'population.homes';
    system: string;
    held?: {
        order: (string)[];
        settle: string;
        placements: ({
            id: string;
            fromY: number;
            y: number;
        })[];
    };
    bodyHomes: ({
        id: string;
        home: {
            x: number;
            y: number;
            z: number;
            r: number;
        };
    })[];
    holds?: {
        system: string;
        rows: ({
            home: number;
            field: string;
            until: string;
        })[];
    };
    groups: Record<string, (string)[]>;
    witness: ({
        groups: (string)[];
    }) | ({
        kinds: (string)[];
    });
}
export type ClientPopulationRows = { [Key in keyof ClientPopulationRowsFields]: ClientPopulationRowsFields[Key] };
interface ClientBossTelegraphRowsInputFields {
    kind: 'boss.telegraph';
    actor: string;
    view: ({
        kind: 'marked';
        rows: v.InferInput<typeof MarkedBossPresentationSchema>;
    }) | ({
        kind: 'lane-sheet';
        strike: string;
        system: string;
        height: number;
        thickness: number;
        y: number;
        ahead: number;
        opacity: [
            number,
            number
        ];
        color: number;
    });
}
export type ClientBossTelegraphRowsInput = { [Key in keyof ClientBossTelegraphRowsInputFields]: ClientBossTelegraphRowsInputFields[Key] };
interface ClientBossTelegraphRowsFields {
    kind: 'boss.telegraph';
    actor: string;
    view: ({
        kind: 'marked';
        rows: v.InferOutput<typeof MarkedBossPresentationSchema>;
    }) | ({
        kind: 'lane-sheet';
        strike: string;
        system: string;
        height: number;
        thickness: number;
        y: number;
        ahead: number;
        opacity: [
            number,
            number
        ];
        color: number;
    });
}
export type ClientBossTelegraphRows = { [Key in keyof ClientBossTelegraphRowsFields]: ClientBossTelegraphRowsFields[Key] };
export type ClientHeldBossRowsInput = ClientHeldBossRows;
export type ClientHeldBossRows = Omit<{
    kind: 'boss.held';
}, keyof ({
    actor: string;
    armed: (boolean) | ({
        flag: string;
    });
    again?: string;
    rewardLabel?: string;
})> & {
    actor: string;
    armed: (boolean) | ({
        flag: string;
    });
    again?: string;
    rewardLabel?: string;
};
export type ClientSpawnedBossRowsInput = ClientSpawnedBossRows;
export type ClientSpawnedBossRows = Omit<{
    kind: 'boss.spawned';
}, keyof ({
    actor: string;
    armed: (boolean) | ({
        flag: string;
    });
    again?: string;
    rewardLabel?: string;
})> & {
    actor: string;
    armed: (boolean) | ({
        flag: string;
    });
    again?: string;
    rewardLabel?: string;
};
export type ClientBossFightRowsInput = (ClientHeldBossRowsInput) | (ClientSpawnedBossRowsInput);
export type ClientBossFightRows = (ClientHeldBossRows) | (ClientSpawnedBossRows);
