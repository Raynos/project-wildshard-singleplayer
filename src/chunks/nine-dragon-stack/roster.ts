/**
 * Nine Dragon Stack's live models (E306 / E315 M5, `ChunkDef.roster`): the gear its player holds — the first-person arms
 * with the Neon Jian and the Fei Zhua gauntlet, and the iron sword. The fragment spawns no creatures (its fauna is
 * empty) and its people (the crowd, the brush-drawn figures) are models its world places. Listed in the Model Explorer
 * at boot (src/models/roster.ts); the held weapons draw as before (their own queue and depth clear).
 */
import type { RosterEntry } from '../../models/live';
import { GEAR } from './models/gear';

export const ROSTER: readonly RosterEntry[] = [...GEAR];
