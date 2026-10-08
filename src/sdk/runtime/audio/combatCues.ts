import { sharedCombatCues as platformCombatCues } from '@wildshard/game/systems/audio/combatCues';

/** Existing mixer operations consumed by the trusted combat-cue router. */
export type CombatAudio = Parameters<typeof platformCombatCues>[0];
/** Route stable equipment cues to the owning mixer's existing recipes, with the original melee-silence policy. */
export const sharedCombatCues: typeof platformCombatCues = platformCombatCues;
