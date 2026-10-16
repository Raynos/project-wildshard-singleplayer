/** Existing attack phase thresholds and actor-memory fields, in their original body-step order. */
export const CRAB_ACTIONS = {
  stateKey: 'st', states: ['idle', 'sidestep', 'attack', 'flee'],
  actions: [{ state: 2, phase: 0.641025641025641, effect: 'snap', once: { key: 'hit', value: 1, test: 'falsy' } }],
} as const;
export const SAILOR_ACTIONS = {
  stateKey: 'st', states: ['hide', 'rise', 'attack', 'guard', 'sink'],
  actions: [{ state: 2, phase: 0.7166666666666667, effect: 'swing', once: { key: 'hit', value: 1, test: 'falsy' } }],
} as const;
export const MONKEY_ACTIONS = {
  stateKey: 'st', states: ['perch', 'ground-idle', 'attack', 'drop', 'ground', 'return', 'climb'],
  actions: [
    { state: 2, phase: 0.45, effect: 'bite', once: { key: 'hit', value: 1, test: 'falsy' }, when: { key: 'bite', test: 'truthy' } },
    { state: 2, phase: 0.62, effect: 'throw', once: { key: 'hit', value: 1, test: 'falsy' }, when: { key: 'bite', test: 'falsy' } },
  ],
} as const;
export const CAPTAIN_ACTIONS = {
  stateKey: 'st', states: ['hide', 'rise', 'fight', 'attack', 'sink', 'under'], cadence: 'decision',
  actions: [{ state: 3, phase: 0, effect: 'swing', once: { key: 'hit', value: 1, test: 'falsy' } }],
} as const;
