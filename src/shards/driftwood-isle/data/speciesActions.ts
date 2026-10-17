import { DRIFTWOOD_STRIKE_ROWS } from './strikes';

/** Existing attack phase thresholds and actor-memory fields, in their original body-step order. */
export const CRAB_ACTIONS = {
  stateKey: 'st', states: ['idle', 'sidestep', 'attack', 'flee'],
  actions: [{ state: 2, phase: 0.641025641025641, strike: DRIFTWOOD_STRIKE_ROWS.snap.id, damage: 'charge', radiusScale: { minimum: 1, factor: 0.8 }, sound: 'crab_snap', once: { key: 'hit', value: 1, test: 'falsy' } }],
} as const;
export const SAILOR_ACTIONS = {
  stateKey: 'st', states: ['hide', 'rise', 'attack', 'guard', 'sink'],
  actions: [{ state: 2, phase: 0.7166666666666667, strike: DRIFTWOOD_STRIKE_ROWS.sailor.id, sound: 'sailor_slash', once: { key: 'hit', value: 1, test: 'falsy' } }],
} as const;
export const MONKEY_ACTIONS = {
  stateKey: 'st', states: ['perch', 'ground-idle', 'attack', 'drop', 'ground', 'return', 'climb'],
  actions: [
    { state: 2, phase: 0.45, effect: 'bite', once: { key: 'hit', value: 1, test: 'falsy' }, when: { key: 'bite', test: 'truthy' } },
    { state: 2, phase: 0.62, effect: 'throw', once: { key: 'hit', value: 1, test: 'falsy' }, when: { key: 'bite', test: 'falsy' } },
  ],
} as const;
