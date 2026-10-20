import { parseChapterWake } from '@wildshard/format/chapterDirector';
import encounter from '../data/bossEncounter.json' with { type: 'json' };
import { QUEST_SERVICES } from './questServiceEffects';

const effects = (id: string) => {
  const row = QUEST_SERVICES.actions.find(action => action.id === id);
  if (row === undefined) throw new Error(`Missing chapter cue effects: ${id}`);
  return row.effects;
};
/** Existing AS finale cues bind the native encounter and baseline bar. */
export const WAKE_ENCOUNTER = parseChapterWake({ version: 1, quest: 'sealed-ring', spawn: 'driftwood.captain',
  director: 'quests/chapter-director.json', encounter,
  cues: [
    { id: 'captain.restore', operation: 'restore', effects: [] },
    { id: 'captain.wake', operation: 'wake', effects: effects('captain-wake'), combat: 1 },
    { id: 'captain.dead', operation: 'effects', effects: effects('captain-dead') },
  ],
  systems: { encounter: 'shard.driftwood-isle.installFinale', director: 'shard.driftwood.director',
    before: ['game.loot', 'body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'] },
});
