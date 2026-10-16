import * as v from 'valibot';
import { QuestNpcBindingsSchema } from '@wildshard/format/npcs';
import { parseQuestHost } from '@wildshard/format/questHost';
import { DRIFTWOOD_QUESTS, DRIFTWOOD_MARKERS } from './quests';
import { QUEST_NPCS } from './questNpcs';
import { QUEST_HOST } from './questHost';

/** Compile the shipping story, dialogue, route order and POI/anchor recipes without a play-time assembler. */
export function driftwoodQuestRows(): Record<string, unknown> {
  return { quests: DRIFTWOOD_QUESTS, markers: DRIFTWOOD_MARKERS,
    npcs: v.parse(QuestNpcBindingsSchema, QUEST_NPCS), host: parseQuestHost(QUEST_HOST) };
}
