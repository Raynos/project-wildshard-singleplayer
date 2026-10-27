import original from './nalati-quest-prop-original.json' with { type: 'json' };
import { NALATI_KOKPAR } from './nalati-kokpar';
import { makeCarriedQuestRows } from '../../src/shards/nalati-grasslands/generators/carriedQuest';

/** Frozen predecessor prop enters the defining quest parser for runtime host tests. */
export const carriedQuestRows = makeCarriedQuestRows(original, NALATI_KOKPAR);
