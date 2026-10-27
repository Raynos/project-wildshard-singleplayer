import authored from '../data/entryRows.json' with { type: 'json' };

const [north, east, south, west] = authored.DRY_ENTRIES;
if (authored.DRY_ENTRIES.length !== 4 || north !== 'north' || east !== 'east' || south !== 'south' || west !== 'west') throw new Error('Authored entry order differs');
const edges: ['north', 'east', 'south', 'west'] = [north, east, south, west];
/** Original authored entry constants, with their consumed cardinal tuple checked at intake. */
export const ENTRY_ROWS = { ...authored, DRY_ENTRIES: edges };
