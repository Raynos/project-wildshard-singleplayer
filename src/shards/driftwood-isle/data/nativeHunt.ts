import { DRIFTWOOD_FAUNA_TUNING, DRIFTWOOD_HUNT_MEMORY_FIELDS } from './fauna';

/** Native hunt ownership; existing version-8 fields and fauna memory subset stay readable. */
export const DRIFTWOOD_NATIVE_HUNT = {
  limit: 256, fight: { telegraphed: true, attackers: 2 }, tuning: DRIFTWOOD_FAUNA_TUNING, player: 'host',
  bands: { states: ['sidestep'], legacyKinds: ['captain'] },
  hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] }, memoryFields: DRIFTWOOD_HUNT_MEMORY_FIELDS,
} as const;
