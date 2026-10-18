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
export const ClientPlayerEnterSchema = v.strictObject({ kind: v.literal('player.enter'),
  pitch: v.exactOptional(v.pipe(finite, v.minValue(-Math.PI / 2), v.maxValue(Math.PI / 2))),
  bounds: v.exactOptional(v.pipe(v.strictObject({ x0: finite, x1: finite, z0: finite, z1: finite, floor: finite }),
    v.check(row => row.x0 < row.x1 && row.z0 < row.z1, 'Ordered player bounds'))),
  columns: v.exactOptional(v.strictObject({ enabledMode: id })),
});
/** Existing held-controller installation; its recipe and resources come from
 * the same admitted model definition used by Explorer. */
export const ClientHeldMeleeSchema = v.strictObject({ kind: v.literal('held.melee'), item: id,
  stage: v.picklist(['kit', 'equipment']), targets: v.picklist(['scan', 'raycast']),
  composed: v.optional(v.boolean(), false), stowedMode: v.exactOptional(id),
  finish: v.exactOptional(v.strictObject({ part: id, look: id, image: id, library: id })),
});
/** The existing SpeciesBrains catalogue, with original registration order and
 * body homes. The program and rig rows are referenced, never copied here. */
export const ClientSpeciesProgramSchema = v.strictObject({ kind: v.literal('species.program'), library: id,
  homes: v.exactOptional(v.pipe(v.record(id, home), v.maxEntries(256))), shove: v.optional(v.boolean(), false),
});
/** Saved page composition on the original flag/reward/NPC owners. Captures
 * select bounded platform actions, never a method or property path. */
export const ClientQuestPageSchema = v.strictObject({ kind: v.literal('quest.page'),
  rows: v.omit(PersistedQuestPageSchema, ['capture']), progress: v.optional(v.boolean(), false),
  promptOrder: v.picklist(['page-npc', 'npc-page']),
  endpoints: v.optional(v.pipe(v.array(v.strictObject({ mover: id, stage: id, toast: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))) })), v.maxLength(64)), []),
  capture: v.optional(v.pipe(v.record(id, v.pipe(v.array(capture), v.maxLength(64))), v.maxEntries(64)), {}),
});
/** Native body allocation/refill policy; placement rows retain their original
 * identities in sim/runtime-plan rather than introducing a second roster. */
export const ClientPopulationSchema = v.strictObject({ kind: v.literal('population.homes'), system: id,
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
export const ClientBossTelegraphSchema = v.strictObject({ kind: v.literal('boss.telegraph'), actor: id,
  view: v.variant('kind', [v.strictObject({ kind: v.literal('marked'), rows: MarkedBossPresentationSchema }),
    v.strictObject({ kind: v.literal('lane-sheet'), strike: id, system: id,
      height: v.pipe(finite, v.minValue(Number.MIN_VALUE)), thickness: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
      y: finite, ahead: finite, opacity: v.tuple([finite, finite]), color: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffff)),
    })]),
});
export const ClientHeldBossSchema = v.strictObject({ kind: v.literal('boss.held'), ...bossFight });
export const ClientSpawnedBossSchema = v.strictObject({ kind: v.literal('boss.spawned'), ...bossFight });
export const ClientBossFightSchema = v.variant('kind', [ClientHeldBossSchema, ClientSpawnedBossSchema]);
export type ClientHeldMelee = v.InferOutput<typeof ClientHeldMeleeSchema>;
export type ClientSpeciesProgram = v.InferOutput<typeof ClientSpeciesProgramSchema>;
export type ClientQuestPage = v.InferOutput<typeof ClientQuestPageSchema>;
export type ClientPopulation = v.InferOutput<typeof ClientPopulationSchema>;
export type ClientBossFight = v.InferOutput<typeof ClientBossFightSchema>;
