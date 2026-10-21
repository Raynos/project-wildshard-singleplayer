import { parseQuestHost } from '@wildshard/format/questHost';
import { pineTableFromPlacements } from './questTable';
import { PINE_GRAPH, pineQuestRows } from './questGraph';
import spots from '../data/spots.generated.json' with { type: 'json' };

/** The root graph and presentation use the same placed interaction table. */
export const PINE_QUEST_TABLE = pineTableFromPlacements(spots.rows);
const interactions = pineQuestRows(PINE_QUEST_TABLE);
const flags = [...new Set(interactions.rows.flatMap(row => [
  ...row.sets, ...row.needs?.flatMap(need => [...need.all ?? [], ...need.any ?? [], ...need.none ?? []]) ?? [],
]))].filter(flag => !interactions.marks.some(mark => mark.id === flag));

/** The existing modal keeper still delivers accepted actions externally. */
export const PINE_QUEST_HOST = parseQuestHost({
  version: 1, graph: PINE_GRAPH, interactions, flags, npcs: [], drive: 'external',
  actors: { ids: [], error: 'Missing quest actor' }, observations: [], stages: [], summons: [],
  commands: { step: null, inputs: {}, routes: [] },
});
