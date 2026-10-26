import { DRIFTWOOD_FAUNA_TUNING, DRIFTWOOD_HUNT_MEMORY_FIELDS } from './fauna';

/** Native hunt ownership; existing version-8 fields and fauna memory subset stay readable. */
export const DRIFTWOOD_NATIVE_HUNT: { readonly limit: 256; readonly fight: { readonly telegraphed: true; readonly attackers: 2; }; readonly tuning: { boar: { sightRange: number; sightRangeGraze: number; sightCone: number; hearWalk: number; hearSprint: number; noticeRate: number; impactAlert: number; }; }; readonly player: "host"; readonly bands: { readonly states: readonly ["sidestep"]; readonly legacyKinds: readonly ["captain"]; }; readonly hit: { readonly namespace: "creature"; readonly tags: readonly ["feel.blow", "cover.checked"]; }; readonly memoryFields: readonly ["timer", "tx", "tz", "fleeT", "fleeUntil", "chargeCd", "callT", "awareness", "freeze", "spooked", "wary", "sensed", "windup", "backoff", "side", "committed", "path", "pathI", "goalX", "goalZ", "repathAt"]; } = {
  limit: 256, fight: { telegraphed: true, attackers: 2 }, tuning: DRIFTWOOD_FAUNA_TUNING, player: 'host',
  bands: { states: ['sidestep'], legacyKinds: ['captain'] },
  hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] }, memoryFields: DRIFTWOOD_HUNT_MEMORY_FIELDS,
} as const;
