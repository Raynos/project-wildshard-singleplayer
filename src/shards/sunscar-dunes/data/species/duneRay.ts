import type { SpeciesData, StrikeData } from '@wildshard/sdk/species';
import { STRINGS } from '../strings';

export const RAY = { glideAlt: 14, glideSpeed: 9, circleR: 20, patrolR: 34, patrolAlt: 22, notice: 55, diveFrom: 38, diveSpeed: 15, climbAlt: 17, climbFor: 2.6, diveMax: 4.5, rest: 3 } as const;

export const SWOOP_DATA: StrikeData = { id: 'sunscar.ray.swoop', shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3, active: 0.4, recover: 0.5, cooldown: 2.5,
  range: 7, damage: 14, tags: ['creature.duneRay'], units: 'world', weight: { kind: 'constant', value: 1 } };

export const DUNE_RAY: SpeciesData = { id: 'sunscar.creature.duneRay', kind: 'duneRay', label: STRINGS.ray, aggressive: true, lockable: true, blood: false,
  // A generous lock (sol-lock, Jake): the ray circles 10–18 m up and swoops from further out than a ground creature.
  flight: { altitude: RAY.glideAlt, above: 'ground', climbRate: 6, diveRate: 24, lockRange: 34 },
  variants: [{ id: 'dusk', label: STRINGS.ray, weight: 1, rarity: 'common', scale: [1, 1.15], hp: 70 }] };

