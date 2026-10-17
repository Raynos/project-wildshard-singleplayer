import { SCOUT_ROW } from './questPresentation';
import { SCOUT_AT } from './rows/flags';
import ground from '../data/manifestGround.generated.json' with { type: 'json' };
import STRINGS from '../data/strings.json' with { type: 'json' };

/** The scout's original exact-point ground query, met flag and loaded-model-only registration. */
export const QUEST_NPC = { npc: SCOUT_ROW, label: STRINGS.talkScout, system: SCOUT_ROW.id,
  sourceFile: 'src/shards/sunscar-dunes/generators/questPresentation.ts',
  ground: { height: ground.heights.scout, at: SCOUT_AT, error: 'Undeclared authored scout ground query' },
  met: 'flag', missing: 'omit', update: 'loaded' } as const;
