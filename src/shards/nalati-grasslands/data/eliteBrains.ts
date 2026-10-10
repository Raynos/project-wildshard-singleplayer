import type { SpeciesBrain, BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { LEOPARD_DATA } from './species/leopard';
import { KOKBORI_DATA } from './species/kokbori';

/** Aqbars' shipping ledge/perch/pounce/swipe law, admitted by the platform species catalogue in both hosts. */
export const AQBARS_BRAIN: SpeciesBrain = { archetype: 'ledge-pouncer', data: {
  initialCooldown: 2, awareCooldown: 1.5, lookIdle: 0.4, homeRadius: 3, pathSeconds: 0.6,
  ledgeMargin: 0.3, standRate: 10, openSeconds: 1.5, openCooldown: 1.2,
  fields: { low: 'low', leap: 'leap', snarl: 'snarl' },
  pose: { stalk: 0.8, perch: 0.2, open: 0.1, leapSwing: 0.6, leapBase: 0.4 },
  speeds: { home: 5, perch: 5.5, stalk: 4.2, back: -1 },
  turns: { home: 3, idle: 1, swipeStart: 6, perch: 4, stalk: 3, tell: 6, open: 2, swipe: 5 },
  stalk: { far: 9, near: 6 },
  perch: { minHeight: 3, maxHeight: 8, minDistance: 4, maxDistance: 14, arrival: 1.4,
    retreatHeight: 2.5, retreatDistance: 25, cooldown: 3.5, waitSeconds: 4 },
  damage: { airborne: 2, openHead: 1.2, perched: 0.25 },
  swipe: { from: 2.4, seconds: 1, first: 0.45, second: 0.8, range: 2.9, damage: 14, cooldown: 1.4 },
  pounce: { minDistance: 7, maxDistance: 12, seconds: 0.6, arcHeight: 1.6, range: 1.9, damage: 35, cooldown: 2.5 },
  tell: { radius: 2.2, strength: 0.6, growth: 0.4, growSeconds: 0.3, seconds: 1 },
} };
/** Existing tell and cue outputs; only the entered presentation answers them. */
export const AQBARS_OPEN = 'Aqbars skids — OPEN';
/** Kokbori's shipping circle/howl/interruption/bite law over the real pack and shared AI stream. */
export const KOKBORI_BRAIN: SpeciesBrain = { archetype: 'pack-howler', data: {
  initialHowl: 8, engagedHowl: 3, phaseCooldown: 1, interruptedHowl: 12, nextHowl: 11, randomHowl: 4,
  pathSeconds: 0.6, pathNear: 6, homePathSeconds: 2, homeStop: 3, homeReset: 4, meleeRadius: 3.8, grassHeight: 0.6, hiddenDamage: 2,
  fields: { howl: 'howl', low: 'low', snarl: 'snarl' },
  speeds: { home: 6, watched: 7, hold: 4, hunt: 8, bite: 6 },
  turns: { home: 3, den: 1.5, hold: 3, howl: 1, hunt: 3.5, bite: 4 },
  hold: { watchedDot: 0.9, minRadius: 24, maxRadius: 32, sidestep: 0.6, arrival: 2, watchedLow: 0.6, low: 0.2 },
  hunt: { snarlDistance: 8, attackDistance: 3.5, moveDistance: 2.5 },
  bite: { seconds: 0.9, phase: 0.7, range: 3.2, damage: 22, cooldown: 1.8 },
  howl: { growSeconds: 0.3, seconds: 1.2, radius: 2, speed: 11, span: 12, strength: 0.85, stagger: 1, scare: 80 },
} };
/** The existing cue outputs, answered only by the entered presentation. */
export const KOKBORI_CUES = { regrouped: 'Kokbori calls the pack back — and comes for you',
  interrupted: 'The howl breaks — the pack scatters', closed: 'PACK HOWL — the pack closes in' };
/** The retained elite policies, using the same body data as the actual page species. */
export const NALATI_ELITE_SPECIES: readonly BrainedSpecies[] = [{ ...LEOPARD_DATA, brain: AQBARS_BRAIN }, { ...KOKBORI_DATA, brain: KOKBORI_BRAIN }];
