import { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';
import { DRIFTWOOD_QUESTS, DRIFTWOOD_MARKERS } from './quests';
import { QUEST_NPCS } from './questNpcs';
import { QUEST_HOST } from './questHost';


/** Compile the shipping story, dialogue, route order and POI/anchor recipes without a play-time assembler. */
export function driftwoodQuestRows(): { quests: typeof DRIFTWOOD_QUESTS; markers: typeof DRIFTWOOD_MARKERS;
  npcs: ReturnType<typeof authorFormatRows<'npcs.QuestNpcBindingsSchema'>>; host: ReturnType<typeof authorFormatRows<'questHost.QuestHostSchema'>> } {
  return { quests: DRIFTWOOD_QUESTS, markers: DRIFTWOOD_MARKERS,
    npcs: authorFormatRows('npcs.QuestNpcBindingsSchema', QUEST_NPCS), host: authorFormatRows('questHost.QuestHostSchema', QUEST_HOST) };
}
