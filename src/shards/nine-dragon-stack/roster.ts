/**
 * Nine Dragon Stack's live models (E306 / E315 M5, `ShardManifest.roster`): the gear its player holds — the first-person arms
 * with the Neon Jian and the Fei Zhua gauntlet (no iron sword: E314 A). The fragment spawns no creatures (its fauna is
 * empty) and its people (the crowd, the brush-drawn figures) are models its world places. Listed in the Model Explorer
 * at boot (src/engine/models/roster.ts); the held weapons draw as before (their own queue and depth clear).
 */
import type { RosterEntry } from '@wildshard/engine/models/live';
import { GEAR } from './models/gear';

export const ROSTER: readonly RosterEntry[] = [...GEAR];
