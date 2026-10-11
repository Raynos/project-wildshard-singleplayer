import { parseNpcDialogueRow } from '@wildshard/sdk/questGraph';
import { RANGER_DIALOGUE, MILLER_DIALOGUE, TRADER_DIALOGUE } from '../data/wardensHollow';

/** The authored dialogue rows admitted by the existing native quest host. */
export const RANGER = parseNpcDialogueRow(RANGER_DIALOGUE);
/** The authored millrace dialogue; flags and completion remain the native quest owner. */
export const MILLER = parseNpcDialogueRow(MILLER_DIALOGUE);
/** The authored trade dialogue; its shop remains the native trader owner. */
export const TRADER = parseNpcDialogueRow(TRADER_DIALOGUE);
