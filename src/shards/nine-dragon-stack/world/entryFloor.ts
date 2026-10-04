// SF51-g (E435): the fragment's fall floor while the entry decks are on. The decks stand at y = 0, 125 m under Lantern
// Square and under the manifest's fall floor (Y0 − 100), which would put a player who walks in from the road straight
// back on the square; with Debug ▸ Nine Dragon entries on, the floor drops under the decks. Off (the default), the
// floor is today's. Node-safe (the manifest reads it).
import { Y0 } from '../layout';

/** the floor under the Well's lowest crossing (Y0 − 93, well-plan.ts), today's */
const FRAGMENT_FLOOR = Y0 - 100;
/** under the entry decks' slabs (their tops at 0, 1.2 m thick) */
const DECK_FLOOR = -20;
let decks = false;

/** the plugin sets it from the row at boot; its scope clears it on unload */
export function setEntryDecksFloor(on: boolean): void { decks = on; }
/** the fall floor the manifest's bounds read */
export function fragmentFallFloor(): number { return decks ? DECK_FLOOR : FRAGMENT_FLOOR; }
