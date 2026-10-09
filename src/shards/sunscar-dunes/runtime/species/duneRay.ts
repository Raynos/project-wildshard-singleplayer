import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { STRINGS } from '../../strings';

/** The flight numbers (metres, m/s, seconds). */
export const RAY = { glideAlt: 14, glideSpeed: 9, circleR: 20, patrolR: 34, patrolAlt: 22, notice: 55, diveFrom: 38, diveSpeed: 15, climbAlt: 17, climbFor: 2.6, diveMax: 4.5, rest: 3 } as const;
/** One swoop: a 3-D sphere at the player's chest (ENGINE §19 "Short flyer example"). */
export const SWOOP: StrikeSpec = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3, active: 0.4, recover: 0.5, cooldown: 2.5,
  range: 7, damage: 14, tags: ['creature.duneRay'], units: 'world', weight: () => 1 };

export const DUNE_RAY: SpeciesRow = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, lockable: true, blood: false,
  // A generous lock (sol-lock, Jake): the ray circles 10–18 m up and swoops from further out than a ground creature.
  flight: { altitude: RAY.glideAlt, above: 'ground', climbRate: 6, diveRate: 24, lockRange: 34 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1.15], hp: 70 }] };

