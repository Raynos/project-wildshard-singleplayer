import { parseQuestHost } from '@wildshard/format/questHost';
import { pineTableFromPlacements } from './questTable';
import { PINE_GRAPH, pineQuestRows } from './questGraph';
import spots from '../data/spots.generated.json' with { type: 'json' };
import policy from '../data/nativeStory.json' with { type: 'json' };
import { contractCatalogue } from './contractRows';

/** The root graph and presentation use the same placed interaction table. */
export const PINE_QUEST_TABLE = pineTableFromPlacements(spots.rows);
const interactions = pineQuestRows(PINE_QUEST_TABLE);
const flags = [...new Set(interactions.rows.flatMap(row => [
  ...row.sets, ...row.needs?.flatMap(need => [...need.all ?? [], ...need.any ?? [], ...need.none ?? []]) ?? [],
]))].filter(flag => !interactions.marks.some(mark => mark.id === flag));

const free = '!riding && !trading && !boarding && !reading';
const owner = (value: number | null, id: string, when: string, actor = policy.actor) =>
  ({ value, actor, spot: null, when, action: { kind: 'owner' as const, id } });
const routes = [
  owner(policy.cancel, 'quest.cancel', '!riding'),
  owner(null, 'quest.trade.close', '!riding && trading'),
  owner(null, 'quest.board.close', '!riding && boarding'),
  owner(null, 'quest.reading.next', '!riding && reading'),
  ...policy.actions.map(action => {
    const common = { value: action.value, when: free };
    if (action.kind === 'row' || action.kind === 'talk') return { ...common,
      spot: action.kind === 'row' ? action.target : `talk.${action.target}`,
      action: { kind: 'owner', id: action.kind === 'row' ? action.target : `talk.${action.target}` } };
    if (action.kind === 'lantern') return { ...common, spot: `signal.${action.target}`, action: { kind: 'row', id: action.row } };
    if (action.kind === 'cable') return { ...common, spot: 'quest.cable', action: { kind: 'owner', id: 'quest.cable' } };
    if (action.kind === 'pickup') return { ...common, when: `${free} && pickup`, spot: 'quest.pickup', action: { kind: 'owner', id: 'quest.pickup' } };
    if (action.kind === 'reward') return { ...common, spot: null, action: { kind: 'owner', id: 'quest.reward' } };
    throw new Error('Unknown native quest command');
  }),
  owner(null, 'quest.trade.use', '!reading && !boarding && !riding', policy.trade),
  owner(0, 'quest.ammo.cycle', `${free} && selectable`, policy.ammo),
  owner(null, 'quest.board.use', '!reading && !trading && !riding', contractCatalogue().id),
];

/** Original modal priority and actor routing are admitted data; the native owner
 * dispatches each command in order at its existing continuation phase. */
export const PINE_QUEST_HOST = parseQuestHost({
  version: 1, graph: PINE_GRAPH, interactions, flags, npcs: [], drive: 'external',
  actors: { ids: [], error: 'Missing quest actor' },
  observations: ['riding', 'trading', 'boarding', 'reading', 'selectable', 'pickup'].map(id => ({ binding: `event:quest.${id}`, kind: 'owner', owner: id })),
  stages: [], summons: [],
  commands: { step: null, inputs: Object.fromEntries(['riding', 'trading', 'boarding', 'reading', 'selectable', 'pickup'].map(id => [id, `event:quest.${id}`])), routes },
});
