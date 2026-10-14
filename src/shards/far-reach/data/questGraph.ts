import { SKY_ACT, SKY_INTERACT } from './questPrompts';
import { VANES } from './layout';
import { FLAGS, vaneFlag } from '../quests/flags';

/** The native quest keeps its original fixed step; external driving adds no adapter or saved cursor. */
export const SKY_GRAPH = { actor: SKY_INTERACT, step: 'far.quest.graph', actions: [] };
/** Exact ordered flag effects. Live roost bodies, eye distance and raised mover pose remain native observations. */
export const SKY_ACTIONS = { marks: [], rows: [
  { id: 'talk', act: SKY_ACT.talk, at: 'keeper', needs: [{ none: [FLAGS.notes] }], sets: [FLAGS.notes] },
  { id: 'notes', act: SKY_ACT.notes, at: 'notes', needs: [], sets: [FLAGS.notes] },
  { id: 'roost', act: 3, at: 'roost', needs: [{ all: [FLAGS.notes], none: [FLAGS.roost] }], sets: [FLAGS.roost] },
  { id: 'vanes', act: 4, at: 'vanes', needs: [{ none: [FLAGS.vanes], all: VANES.map(vane => vaneFlag(vane.id)) }], sets: [FLAGS.vanes] },
  { id: 'raised', act: 5, at: 'winch', needs: [{ none: [FLAGS.raised] }], sets: [FLAGS.raised] },
] };
