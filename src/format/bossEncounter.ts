import * as v from 'valibot';
import { RoamingBossProfileSchema } from './bossProfiles';

const finite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const fraction = v.pipe(finite, v.minValue(0), v.maxValue(1));
const combatId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const combatEffectId = v.pipe(combatId, v.regex(/^effect\./u)) as v.GenericSchema<`effect.${string}`>;
/** Client encounter effects bind the entered player's existing services. */
export const BossCombatSessionSchema = v.strictObject({ id: v.exactOptional(combatId), god: v.boolean(), bossKinds: v.pipe(v.array(combatId), v.maxLength(64)),
  stunEffect: combatEffectId, unlockSkins: v.pipe(v.array(combatId), v.maxLength(64)) });
/** Shared boss identity and checkpoint phase rows. */
export const BossEncounterDefinitionSchema = v.strictObject({ id: key, name: key, title: v.string(), retryTitle: v.string(), intro: finite, introShort: finite,
  phases: v.pipe(v.array(v.strictObject({ at: fraction, caption: v.string(), name: v.string() })), v.minLength(1), v.maxLength(64)) });
const wireFields = ['body', 'present', 'sealed', 'sealK', 'darkK', 'glow', 'invuln', 'lockHp', 'won', 'phase', 'mode', 'modeT', 'strikeCd', 'burstCd', 'summonCd', 'chain', 'open', 'lane', 'rings', 'hazards', 'adds', 'addLanes', 'rngs'] as const;
/** Roaming encounter policy around an existing decision guest and native roster.
 * Wire aliases preserve established saves without imposing shard field names. */
export const RoamingEncounterSchema = v.pipe(v.strictObject({
  definition: BossEncounterDefinitionSchema, profile: RoamingBossProfileSchema, kind: key,
  streams: v.strictObject({ call: key, charge: key }), strikePrefix: key,
  presence: v.strictObject({ enter: positive, leave: positive }),
  steps: v.strictObject({ fight: key, presence: key, dormant: key, reward: key }),
  record: v.strictObject({ defeated: key, paid: key }),
  lanes: v.strictObject({ boss: key, add: key, count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256)) }),
  adds: v.strictObject({ variant: key, state: v.picklist(['alert', 'attack', 'charge', 'dead', 'flee', 'graze', 'hide', 'idle', 'perch', 'rise', 'sidestep', 'stalk', 'wander']) }),
  actionField: key, actions: v.pipe(v.record(key, finite), v.maxEntries(64)),
  reward: v.strictObject({ hover: finite, radius: positive }),
  wire: v.array(v.tuple([key, v.picklist(wireFields)])),
}), v.check(row => row.presence.leave >= row.presence.enter
  && new Set(Object.values(row.steps)).size === 4
  && row.definition.phases.length === row.profile.fight.phases.length
  && row.definition.phases.every((phase, i) => phase.at === row.profile.fight.phases[i]?.at)
  && [row.profile.fight.strike.action, row.profile.fight.burst.action, row.profile.fight.summon.action, row.profile.fight.lanes.action].every(action => row.actions[action] !== undefined)
  && row.wire.length === wireFields.length
  && new Set(row.wire.map(([name]) => name)).size === wireFields.length
  && new Set(row.wire.map(([, field]) => field)).size === wireFields.length
  && row.wire.every(([name]) => !['decision', 'first', 'lightActive', 'hidden'].includes(name)), 'Invalid encounter phases, steps, presence or wire aliases'));
/** Data supplied by the shard; admission happens before steps or bodies exist. */
export type RoamingEncounterRow = v.InferOutput<typeof RoamingEncounterSchema>;
/** Strict row parser shared by native and rendered bindings. */
export function parseRoamingEncounter(input: unknown, profile: unknown): RoamingEncounterRow {
  return v.parse(RoamingEncounterSchema, { ...v.parse(v.record(v.string(), v.unknown()), input), profile });
}

/** Flag-woken encounter with an externally owned decision guest/body clock. */
export const WakeEncounterSchema = v.pipe(v.strictObject({ id: key, level: key, name: key, step: key, kind: key,
  arena: v.strictObject({ radius: positive }), wakeFlag: key, deadFlag: key,
  phases: v.pipe(v.array(v.strictObject({ at: fraction })), v.minLength(1), v.maxLength(64)),
  fields: v.strictObject({ awake: key, rise: key, phase: key, poolX: key, poolZ: key, arena: key }),
  presentation: v.strictObject({ riseAbove: finite, cuts: v.array(finite) }),
  events: v.strictObject({ restore: key, wake: key }),
}), v.check(row => row.phases[0]?.at === 1
  && row.phases.every((phase, i) => i === 0 || phase.at < (row.phases[i - 1]?.at ?? 0))
  && row.presentation.cuts.length === row.phases.length - 1
  && row.presentation.cuts.every((cut, i) => cut === row.phases[i + 1]?.at)
  && row.events.restore !== row.events.wake && row.wakeFlag !== row.deadFlag, 'Invalid wake phases, bar or event binding'));
/** A wake-only shell never takes ownership of the guest's phase decisions. */
export type WakeEncounterRow = v.InferOutput<typeof WakeEncounterSchema>;
/** Admit the complete wake, arena, phase and presentation declaration. */
export function parseWakeEncounter(input: unknown): WakeEncounterRow { return v.parse(WakeEncounterSchema, input); }

const phase = v.picklist([1, 2, 3]);
const scoreAction = v.variant('kind', [
  v.strictObject({ kind: v.literal('scene'), value: key }),
  v.strictObject({ kind: v.literal('ambient') }),
  v.strictObject({ kind: v.literal('phase'), value: phase }),
  v.strictObject({ kind: v.literal('phase-index'), values: v.array(phase), otherwise: phase }),
  v.strictObject({ kind: v.literal('combat'), value: finite }),
  v.strictObject({ kind: v.literal('sting'), value: v.picklist(['chunk', 'death', 'pickup']) }),
]);
const score = v.strictObject({ intro: v.array(scoreAction), phase: v.array(scoreAction), victory: v.array(scoreAction), death: v.array(scoreAction), pickup: v.array(scoreAction) });
/** Reward card strings and music actions admitted with a rendered encounter. */
export const BossEncounterPresentationSchema = v.strictObject({ reward: v.strictObject({ tier: key, name: key, flavour: key, prompt: key }), score });
/** Read rendered cards/music hooks without installing another clock or reward owner. */
export function bossEncounterPresentation(input: unknown, encounter: { readonly definition: v.InferOutput<typeof BossEncounterDefinitionSchema> }): v.InferOutput<typeof BossEncounterPresentationSchema> & { definition: v.InferOutput<typeof BossEncounterDefinitionSchema> } {
  return { definition: encounter.definition, ...v.parse(BossEncounterPresentationSchema, input) };
}

/** Concrete native service ids and pose/reward rows; no arbitrary hooks. */
export const NativeBossBindingSchema = v.strictObject({ population: key,
  weakPoint: v.strictObject({ radius: positive }),
  reward: v.strictObject({ inventory: key, grants: v.pipe(v.array(v.strictObject({ item: key, count: v.pipe(finite, v.integer(), v.minValue(1)) })), v.maxLength(64)) }),
});
export type NativeBossBinding = v.InferOutput<typeof NativeBossBindingSchema>;
