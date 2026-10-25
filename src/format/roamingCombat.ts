import * as v from 'valibot';
import { BossCombatSessionSchema, BossEncounterPresentationSchema } from './bossEncounter';
import { RoamingBossProjectionSchema } from './roamingBossProjection';
import { EliteEnteredPresentationSchema } from './eliteFeature';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** Client-only encounter session resolves its installed loadout and body ids. */
export const RoamingCombatSchema: v.GenericSchema<RoamingCombatRowsInput, RoamingCombatRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Combat composition requires JSON rows'), v.strictObject({
  session: BossCombatSessionSchema, projection: RoamingBossProjectionSchema, presentation: BossEncounterPresentationSchema,
  elitePresentation: EliteEnteredPresentationSchema,
  loadout: id, elites: id, persistence: id, score: id, availability: n, dayScene: id, nightScene: id,
  parked: v.strictObject({ name: id, y: n, finishes: v.pipe(v.array(id), v.maxLength(16)) }),
  reward: v.strictObject({ finish: id, bowScale: n, bowPitch: n, trophy: id, count: n }),
  tells: v.strictObject({ count: v.pipe(n, v.integer(), v.minValue(0), v.maxValue(3)), colour: v.tuple([n, n, n]), range: n, near: n, ahead: n,
    width: n, scale: n, alpha: n, pulse: n, frequency: n }),
  system: v.strictObject({ id, before: v.array(id) }), observers: v.strictObject({ elites: id, boss: id }),
}));

/** Admitted combat data, independent of validator implementation metadata. */
export type RoamingCombatRowsInput = unknown;
export interface RoamingCombatRows { session: v.InferOutput<typeof BossCombatSessionSchema>; projection: v.InferOutput<typeof RoamingBossProjectionSchema>; presentation: v.InferOutput<typeof BossEncounterPresentationSchema>; elitePresentation: v.InferOutput<typeof EliteEnteredPresentationSchema>; loadout: string; elites: string; persistence: string; score: string; availability: number; dayScene: string; nightScene: string; parked: { name: string; y: number; finishes: (string)[]; }; reward: { finish: string; bowScale: number; bowPitch: number; trophy: string; count: number; }; tells: { count: number; colour: [number, number, number]; range: number; near: number; ahead: number; width: number; scale: number; alpha: number; pulse: number; frequency: number; }; system: { id: string; before: (string)[]; }; observers: { elites: string; boss: string; }; }
