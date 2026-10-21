import { parseQuestHost } from '@wildshard/format/questHost';
import { PINE_QUEST_RUNTIME } from './questRuntime';

/** The existing modal keeper still delivers accepted actions externally. */
export const PINE_QUEST_HOST = parseQuestHost({
  version: 1, graph: PINE_QUEST_RUNTIME.graph, interactions: PINE_QUEST_RUNTIME.interactions, npcs: [], drive: 'external',
  actors: { ids: [], error: 'Missing quest actor' }, observations: [], stages: [], summons: [],
  commands: { step: null, inputs: {}, routes: [] },
});
/** Append table flags without changing the existing saved flag order. */
export const PINE_HOST_FLAGS = [...new Set(PINE_QUEST_HOST.interactions.rows.flatMap(row => [
  ...row.sets, ...row.needs?.flatMap(need => [...need.all ?? [], ...need.any ?? [], ...need.none ?? []]) ?? [],
]))].filter(flag => !PINE_QUEST_HOST.interactions.marks.some(mark => mark.id === flag));
