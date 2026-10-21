import { QUEST_PRESENTATION } from './questPresentation';
import journal from '../data/questJournal.json' with { type: 'json' };
import bench from '../data/questBench.json' with { type: 'json' };
import { parseQuestStory } from '@wildshard/format/questStory';

/** The shipped strings, flag filters, migration and seat pose; no live state. */
const base = parseQuestStory({
  quest: { id: 'wardens-hollow', markers: {} },
  presentation: QUEST_PRESENTATION, journal, bench, ignoredFlagPrefixes: ['plate:', 'lever:'],
  notices: [],
});

/** One admitted chapter uses the same saved state, notices and objective owner as the other page entries. */
export const PAGE_STORY = parseQuestStory({ ...base, chapters: {
  chapters: [base.quest.id], talks: [], rewards: {}, flagEvents: [], introTitle: base.presentation.introTitle,
  chapterTitle: '{title}', completedObjective: '{objective}', completedHint: '', rewardKicker: '', rewardSubtitle: '',
  started: '', objective: '', rewardMs: 0, messages: base.presentation.messages,
} });
