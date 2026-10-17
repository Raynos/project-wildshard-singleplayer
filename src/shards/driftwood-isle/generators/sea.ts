import { ENTRY_ASPHALT } from '@wildshard/format/contentBounds';
import authoredEntryRows from '../data/entryRows.json' with { type: 'json' };

const { DRY_ENTRIES } = authoredEntryRows;

/** Shared authoring and native sea facts; the world owns only its live water queries. */
/** The authored waterline; G164 lowers the entire world by WORLD_DROP. */
export const SHORE_LEVEL = 0.8;
export const WORLD_DROP = 0.8;
/** The original whole-bay start of each native entry pier. */
export const PIER_START = Math.floor(ENTRY_ASPHALT / 3) * 3;
/** One declared sea row, read by the product and native water owner. */
export const DECLARED_SEA = { id: 'sea', kind: 'sea', level: SHORE_LEVEL - WORLD_DROP, waves: true, dryEntries: DRY_ENTRIES } as const;
