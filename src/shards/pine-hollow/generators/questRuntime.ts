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

const table = pineTableFromPlacements(spots.rows);
/** Fixed quest laws and words; flags, reading clocks, modal ordering and saved state remain live. */
export const PINE_QUEST_RUNTIME = {
  lead, steps, table, graph: PINE_GRAPH, interactions: pineQuestRows(table), readings: PINE_READINGS,
  policy: { resinCount: RESIN_COUNT, resinFlag: RESIN_FLAG, tokenFlag: TOKEN_FLAG, tokenNames: TOKEN_NAMES,
    readingDelay: PINE_READING_DELAY, lanternIds: PINE_LANTERN_IDS },
  events: PINE_KIT_EVENTS, deaths: PINE_DEATH_EFFECTS, pageDeaths: PINE_PAGE_DEATH_EFFECTS,
  beats: Object.fromEntries(Object.entries(BEATS).map(([id, beat]) => [id, { ...beat, flags: beatFlags(id as Beat) }])),
  content: pineQuestContent(contractCatalogue(), tradeCatalogue()),
};
