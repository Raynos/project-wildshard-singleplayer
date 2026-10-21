import { PAGE_LIFE } from './pageLife';
import lead from '../data/questLead.json' with { type: 'json' };
import steps from '../data/questSteps.json' with { type: 'json' };
import { PINE_QUEST_HOST, PINE_QUEST_TABLE } from './questHost';
import { RESIN_COUNT, RESIN_FLAG, TOKEN_FLAG, TOKEN_NAMES, PINE_READING_DELAY, PINE_LANTERN_IDS } from './interactions';
import { PINE_KIT_EVENTS } from './questEvents';
import { PINE_DEATH_EFFECTS, PINE_PAGE_DEATH_EFFECTS } from './questDeaths';
import { PINE_READINGS } from './readings';
import { pineQuestContent } from './questContent';
import { contractCatalogue } from './contractRows';
import { tradeCatalogue } from './trades';

/** Fixed quest laws and words; flags, reading clocks, modal ordering and saved state remain live. */
export const PINE_QUEST_RUNTIME = {
  leadPage: { quest: 'wardens-hollow', signal: 'lead', actor: { kind: 'deer', variant: 'ghost' }, path: lead.path,
    motion: { faceTurn: 3, trotSpeed: 4.5, trotTurn: 4, stopTurn: 1 }, sound: 'deer_call',
    puffs: { color: [0.75, 1.6, 2.0], count: 3, height: 1.1, appear: [2.6, 0.7, 0.55, 0.7], fade: [0.6, 3.2, 0.7, 0.95] } },
  spawns: { quest: 'wardens-hollow', script: 'pine.night', channel: 1, limit: { phone: 3, desktop: 4 },
    complete: [{ flag: 'errand:done', effects: [
      { kind: 'flag', flag: 'errand:done' },
      { kind: 'toast', text: 'The last of them goes down in the race. Behind you the mill wheel shudders, and turns' },
      { kind: 'sting', name: 'chunk' },
    ] }],
    cues: [{ id: 1, kind: 'sound', name: 'thrall_call' }, { id: 2, kind: 'sound', name: 'thrall_groan' },
      { id: 3, kind: 'sound', name: 'thrall_move' }, { id: 4, kind: 'puff' }],
    puffs: { color: [0.55, 0.7, 0.62], count: 3, height: 1, burst: [1.2, 3.4, 0.8, 0.8] } },
  lead: { ...lead, program: PAGE_LIFE.program }, steps, table: PINE_QUEST_TABLE, graph: PINE_QUEST_HOST.graph, interactions: PINE_QUEST_HOST.interactions, readings: PINE_READINGS,
  policy: { resinCount: RESIN_COUNT, resinFlag: RESIN_FLAG, tokenFlag: TOKEN_FLAG, tokenNames: TOKEN_NAMES,
    readingDelay: PINE_READING_DELAY, lanternIds: PINE_LANTERN_IDS },
  events: PINE_KIT_EVENTS, deaths: PINE_DEATH_EFFECTS, pageDeaths: PINE_PAGE_DEATH_EFFECTS,
  content: pineQuestContent(contractCatalogue(), tradeCatalogue()),
};

// Root questHost is the single page/native graph declaration. The remaining
// story payload carries presentation and continuation data only.
const { graph: _graph, interactions: _interactions, policy: _policy, ...payload } = PINE_QUEST_RUNTIME;
export const PINE_QUEST_PAYLOAD = { ...payload, policy: { readingDelay: PINE_READING_DELAY } };
