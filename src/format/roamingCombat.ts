import * as v from 'valibot';
import { BossCombatSessionSchema, BossEncounterPresentationSchema } from './bossEncounter';
import { RoamingBossProjectionSchema } from './roamingBossProjection';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** Client-only encounter session resolves its installed loadout and body ids. */
export const RoamingCombatSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Combat composition requires JSON rows'), v.strictObject({
  session: BossCombatSessionSchema, projection: RoamingBossProjectionSchema, presentation: BossEncounterPresentationSchema,
  loadout: id, elites: id, persistence: id, score: id, availability: n, dayScene: id, nightScene: id,
  parked: v.strictObject({ name: id, y: n, finishes: v.pipe(v.array(id), v.maxLength(16)) }),
  reward: v.strictObject({ finish: id, bowScale: n, bowPitch: n, trophy: id, count: n }),
  tells: v.strictObject({ count: v.pipe(n, v.integer(), v.minValue(0), v.maxValue(3)), colour: v.tuple([n, n, n]), range: n, near: n, ahead: n,
    width: n, scale: n, alpha: n, pulse: n, frequency: n }),
  system: v.strictObject({ id, before: v.array(id) }), observers: v.strictObject({ elites: id, boss: id }),
}));
