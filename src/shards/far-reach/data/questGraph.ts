import { parseInteractionRows } from '@wildshard/sdk/interactions';
import { parseQuestGraph } from '@wildshard/sdk/questGraph';
import { VANES } from './layout';
import { FLAGS, vaneFlag } from '../quest/flags';

/** The native quest keeps its original fixed step; external driving adds no adapter or saved cursor. */
export const SKY_GRAPH = parseQuestGraph({ actor: 'far.interact', step: 'far.quest.graph', actions: [] });
/** Exact ordered flag effects. Live roost bodies, eye distance and raised mover pose remain native observations. */
export const SKY_ACTIONS = parseInteractionRows({ marks: [], rows: [
  { id: 'talk', act: 0, at: 'keeper', needs: [{ none: [FLAGS.notes] }], sets: [FLAGS.notes] },
  { id: 'notes', act: 1, at: 'notes', needs: [], sets: [FLAGS.notes] },
  { id: 'roost', act: 3, at: 'roost', needs: [{ all: [FLAGS.notes], none: [FLAGS.roost] }], sets: [FLAGS.roost] },
  { id: 'vanes', act: 4, at: 'vanes', needs: [{ none: [FLAGS.vanes], all: VANES.map(vane => vaneFlag(vane.id)) }], sets: [FLAGS.vanes] },
  { id: 'raised', act: 5, at: 'winch', needs: [{ none: [FLAGS.raised] }], sets: [FLAGS.raised] },
] });
