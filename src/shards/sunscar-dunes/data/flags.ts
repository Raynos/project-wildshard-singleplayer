import { SPAWN } from '../layout';

/** The quest's flags (persisted per shard by `Flags`); plain data, so shard.config.ts can declare the quest (SHARD-PLATFORM M3). */
export const FLAG = { logbook: 'sunscar.logbook', oil: 'sunscar.oil', brazierPrefix: 'sunscar.brazier.', lit: 'sunscar.lit' } as const;
/** Raised when the player has talked to Sefa: the quest's first step (P4, the lead's pick: the quest starts at an NPC, as Driftwood's Wendell). */
export const SCOUT_FLAG = 'sunscar.scout';
/**
 * Where Sefa stands: on the spawn crest beside the player, 5 m to the right and a little behind, facing the spawn (E407 row
 * 9, the audit: the mockups' first look is an empty vista of the dunes and the tower; she stood 8 m ahead in it). Her pin
 * and her wave (in range from the first frame) bring the player round to her; the quest is unchanged. Round 17 (seat C:
 * at 5 m the tracker dropped her distance, so the first frame had no cue behind the player): 8 m, right and behind, where
 * the tracker reads "SEFA 8 M" as it did in round 14, still out of both spawn frames and inside her wave range.
 */
export const SCOUT_AT = { x: SPAWN.x + 7, z: SPAWN.z + 4 } as const;
