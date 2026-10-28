import * as v from 'valibot';
import { authorFormatSchema } from '@wildshard/sdk/formatJsonSchema';
import { DRIFTWOOD_QUESTS, DRIFTWOOD_MARKERS } from './quests';
import { QUEST_NPCS } from './questNpcs';
import { QUEST_HOST } from './questHost';

const QuestNpcBindingsSchema: ReturnType<typeof authorFormatSchema<'npcs.QuestNpcBindingsSchema'>> = authorFormatSchema('npcs.QuestNpcBindingsSchema');
const QuestHostSchema: ReturnType<typeof authorFormatSchema<'questHost.QuestHostSchema'>> = authorFormatSchema('questHost.QuestHostSchema');

/** Compile the shipping story, dialogue, route order and POI/anchor recipes without a play-time assembler. */
export function driftwoodQuestRows(): { quests: typeof DRIFTWOOD_QUESTS; markers: typeof DRIFTWOOD_MARKERS;
  npcs: v.InferOutput<typeof QuestNpcBindingsSchema>; host: v.InferOutput<typeof QuestHostSchema> } {
  return { quests: DRIFTWOOD_QUESTS, markers: DRIFTWOOD_MARKERS,
    npcs: v.parse(QuestNpcBindingsSchema, QUEST_NPCS), host: v.parse(QuestHostSchema, QUEST_HOST) };
}
