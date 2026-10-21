import { DRIFTWOOD_MARKERS } from './quests';
import { QUEST_PRESENTATION } from './questPresentation';
import journal from '../data/questJournal.json' with { type: 'json' };
import bench from '../data/questBench.json' with { type: 'json' };
import { parseQuestStory } from '@wildshard/format/questStory';

/** The shipped strings, flag filters, migration and seat pose; no live state. */
const base = parseQuestStory({
  quest: { id: 'sealed-ring', markers: DRIFTWOOD_MARKERS },
  presentation: QUEST_PRESENTATION, journal, bench, ignoredFlagPrefixes: ['plate:', 'lever:'],
  notices: [{ prefix: 'glass:', total: 15, text: 'Every piece of sea glass on the island · 15 / 15' }],
});

/** The same chapter presenter as the multi-chapter adventures, retaining the island's original single-quest messages. */
export const PAGE_STORY = parseQuestStory({ ...base, chapters: {
  chapters: [base.quest.id], talks: [], rewards: {}, flagEvents: [], introTitle: base.presentation.introTitle,
  chapterTitle: '{title}', completedObjective: '{objective}', completedHint: '', rewardKicker: '', rewardSubtitle: '',
  started: '', objective: '', rewardMs: 0, messages: base.presentation.messages,
} });
