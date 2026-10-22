import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { ANTLER_KING } from './runtime/models/antlerKing';

/** The remaining custom rig card; ordinary cards are admitted catalogue rows. */
export function preparedRoster(): readonly RosterEntry[] { return [live(ANTLER_KING.model, { planned: 1 })]; }
