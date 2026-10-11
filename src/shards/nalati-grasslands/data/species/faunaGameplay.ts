import type { SpeciesData } from '@wildshard/sdk/species';
import { NALATI_RIDE } from '../modes';

type SpeciesGameplay = Pick<SpeciesData, 'aggressive' | 'walkSpeed' | 'chargeSpeed' | 'chargeDamage' | 'sounds' | 'tuning' | 'tick' | 'trampleRadius'>;

/** Shipping horse movement, hearing, alert, flee and sound parameters; view/variant fields stay native. */
export const HORSE_GAMEPLAY = {
  aggressive: false,
  walkSpeed: NALATI_RIDE.gaits.walk,
  chargeSpeed: 12,
  chargeDamage: 25,
  sounds: { call: 'horse_neigh', hurt: 'horse_squeal', callEvery: [40, 120] },
  tuning: {
    hp: 150, sightRange: 45, sightRangeGraze: 20, sightCone: 70 * (Math.PI / 180),
    hearStill: 4, hearCrouch: 8, hearWalk: 15, hearSprint: 30,
    noticeRate: 0.4, forgetRate: 0.2, alertAt: 0.45, boltAt: 1, freezeMin: 2, freezeMax: 4, relaxAfter: 4, panicDist: 10,
    runSpeed: 12.5, trotSpeed: 4.5, fleeMinTime: 3, fleeUntil: 80, fleeUntilMax: 120, fleeMaxTime: 14, lookBack: 3,
    waryTime: 20, waryBoost: 1.3, herdAlertRadius: 20, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.8, impactSpook: 15, impactAlert: 40,
  },
  tick: 'ai',
  trampleRadius: 0.8,
} satisfies SpeciesGameplay;

/** Shipping wolf movement, hearing, alert, flee and sound parameters; view/variant fields stay native. */
export const WOLF_GAMEPLAY = {
  aggressive: true,
  walkSpeed: 1.6,
  chargeSpeed: 9.5,
  chargeDamage: 12,
  sounds: { call: 'wolf_howl', hurt: 'wolf_yelp', callEvery: [60, 160] },
  tuning: {
    hp: 70, sightRange: 35, sightRangeGraze: 35, sightCone: 70 * (Math.PI / 180),
    hearStill: 4, hearCrouch: 8, hearWalk: 16, hearSprint: 30,
    noticeRate: 0.45, forgetRate: 0.12, alertAt: 0.35, boltAt: 1, freezeMin: 0.5, freezeMax: 1, relaxAfter: 8, panicDist: 0,
    runSpeed: 9.5, trotSpeed: 4.0, fleeMinTime: 2, fleeUntil: 60, fleeUntilMax: 80, fleeMaxTime: 12, lookBack: 1,
    waryTime: 30, waryBoost: 1.3, herdAlertRadius: 40, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.6, impactSpook: 0, impactAlert: 25,
  },
  tick: 'ai',
  trampleRadius: 0.45,
} satisfies SpeciesGameplay;
