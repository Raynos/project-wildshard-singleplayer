import { QUEST_PRESENTATION } from './questPresentation';
import journal from '../data/questJournal.json' with { type: 'json' };
import bench from '../data/questBench.json' with { type: 'json' };
import { parseQuestStory } from '@wildshard/format/questStory';

/** The shipped strings, flag filters, migration and seat pose; no live state. */
export const PAGE_STORY = parseQuestStory({
  quest: { id: 'wardens-hollow', markers: {} },
  presentation: QUEST_PRESENTATION, journal, bench, ignoredFlagPrefixes: ['plate:', 'lever:'],
  notices: [],
});
