import { QUEST_PRESENTATION } from './questPresentation';
import journal from '../data/questJournal.json' with { type: 'json' };
import bench from '../data/questBench.json' with { type: 'json' };
import page from '../data/forestStory.json' with { type: 'json' };
import { parseQuestStory } from '@wildshard/format/questStory';
import steps from '../data/questSteps.json' with { type: 'json' };
import { PINE_QUEST_SERVICES } from './questConsequences';

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
  // G565: the stag lead gates itself on its quest step (AS) and raises leadAppear / leadDone, whose effects are these rows
  decision: { observations: { taken: { source: { flag: page.secret.flag }, on: 'secret' }, leadStep: { source: { quest: 'wardens-hollow', step: 'stag', state: 'active' }, on: 'lead' } },
    actions: { accept: [{ kind: 'flag', flag: page.secret.flag }, { kind: 'toast', text: page.secret.text }],
      leadAppear: PINE_QUEST_SERVICES.actions.filter(row => row.id === 'stag.appear').flatMap(row => row.effects),
      leadDone: [...steps.steps.filter(row => row.kind === 'follow' && row.target === 'stag').flatMap<unknown>(row => row.effects),
        ...PINE_QUEST_SERVICES.actions.filter(row => row.id === 'stag.complete').flatMap(row => row.effects)] } },
} });
