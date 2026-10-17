import { parseNpcDialogueRow } from '@wildshard/sdk/questGraph';
import people from '../data/questNpcs.generated.json' with { type: 'json' };

/** The authored dialogue rows admitted by the existing native quest host. */
export const RANGER = parseNpcDialogueRow(people.rows.find(row => row.npc.id === 'ranger')?.npc);
/** The authored millrace dialogue; flags and completion remain the native quest owner. */
export const MILLER = parseNpcDialogueRow(people.rows.find(row => row.npc.id === 'miller')?.npc);
/** The authored trade dialogue; its shop remains the native trader owner. */
export const TRADER = parseNpcDialogueRow(people.rows.find(row => row.npc.id === 'trader')?.npc);
