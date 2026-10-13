import { KEEPER_ROW } from './keeperLook';
import { DECK } from './layout';
import { STRINGS } from './strings';

/** The keeper's original anchor and always-registered, always-unmet motion, including an unloaded model. */
export const QUEST_NPC = { npc: KEEPER_ROW, label: STRINGS.talkKeeper, system: 'far.keeper',
  sourceFile: 'src/shards/far-reach/data/keeperLook.ts', ground: { height: DECK, at: null, error: 'Undeclared NPC ground query' },
  met: 'unmet', missing: 'anchor', update: 'always' } as const;
