import { PAGE_LIFE } from './pageLife';
import lead from '../data/questLead.json' with { type: 'json' };
import steps from '../data/questSteps.json' with { type: 'json' };
import { pineTableFromPlacements } from './questTable';
import { PINE_GRAPH, pineQuestRows } from './questGraph';
import { RESIN_COUNT, RESIN_FLAG, TOKEN_FLAG, TOKEN_NAMES, PINE_READING_DELAY, PINE_LANTERN_IDS } from './interactions';
import { PINE_KIT_EVENTS } from './questEvents';
import { PINE_DEATH_EFFECTS, PINE_PAGE_DEATH_EFFECTS } from './questDeaths';
import { PINE_READINGS } from './readings';
import { BEATS, beatFlags, type Beat } from './questBeats';
import { pineQuestContent } from './questContent';
import { contractCatalogue } from './contractRows';
import { tradeCatalogue } from './trades';
import spots from '../data/spots.generated.json' with { type: 'json' };
import { PINE_QUEST_SERVICES } from './questConsequences';

const table = pineTableFromPlacements(spots.rows);
/** Fixed quest laws and words; flags, reading clocks, modal ordering and saved state remain live. */
export const PINE_QUEST_RUNTIME = {
  leadPage: { quest: 'wardens-hollow', step: 'stag', signal: 'lead', nightAbove: 0.5, actor: { kind: 'deer', variant: 'ghost' }, path: lead.path,
    motion: { faceTurn: 3, trotSpeed: 4.5, trotTurn: 4, stopTurn: 1 }, sound: 'deer_call',
    effects: { appear: PINE_QUEST_SERVICES.actions.filter(row => row.id === 'stag.appear').flatMap(row => row.effects),
      complete: [...steps.steps.filter(row => row.kind === 'follow' && row.target === 'stag').flatMap<unknown>(row => row.effects),
        ...PINE_QUEST_SERVICES.actions.filter(row => row.id === 'stag.complete').flatMap(row => row.effects)] },
    puffs: { color: [0.75, 1.6, 2.0], count: 3, height: 1.1, appear: [2.6, 0.7, 0.55, 0.7], fade: [0.6, 3.2, 0.7, 0.95] } },
  spawns: { quest: 'wardens-hollow', script: 'pine.night', channel: 1, limit: { phone: 3, desktop: 4 },
    flags: [{ flag: 'errand:asked', when: { all: ['errand:asked'], none: ['errand:done'] } }],
    complete: [{ flag: 'errand:done', when: { all: ['errand:asked'], none: ['errand:done'] }, effects: [
      { kind: 'flag', flag: 'errand:done' },
      { kind: 'toast', text: 'The last of them goes down in the race. Behind you the mill wheel shudders, and turns' },
      { kind: 'sting', name: 'chunk' },
    ] }],
    cues: [{ id: 1, kind: 'sound', name: 'thrall_call' }, { id: 2, kind: 'sound', name: 'thrall_groan' },
      { id: 3, kind: 'sound', name: 'thrall_move' }, { id: 4, kind: 'puff' }],
    puffs: { color: [0.55, 0.7, 0.62], count: 3, height: 1, burst: [1.2, 3.4, 0.8, 0.8] } },
  lead: { ...lead, program: PAGE_LIFE.program }, steps, table, graph: PINE_GRAPH, interactions: pineQuestRows(table), readings: PINE_READINGS,
  policy: { resinCount: RESIN_COUNT, resinFlag: RESIN_FLAG, tokenFlag: TOKEN_FLAG, tokenNames: TOKEN_NAMES,
    readingDelay: PINE_READING_DELAY, lanternIds: PINE_LANTERN_IDS },
  events: PINE_KIT_EVENTS, deaths: PINE_DEATH_EFFECTS, pageDeaths: PINE_PAGE_DEATH_EFFECTS,
  beats: Object.fromEntries(Object.entries(BEATS).map(([id, beat]) => [id, { ...beat, flags: beatFlags(id as Beat) }])),
  content: pineQuestContent(contractCatalogue(), tradeCatalogue()),
};
