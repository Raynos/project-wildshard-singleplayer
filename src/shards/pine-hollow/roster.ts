import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { antlerKing } from './runtime/models/antlerKing';

/** The remaining custom rig card; ordinary cards are admitted catalogue rows. */
export function preparedRoster(): readonly RosterEntry[] { return [live(antlerKing, { planned: 1 })]; }
