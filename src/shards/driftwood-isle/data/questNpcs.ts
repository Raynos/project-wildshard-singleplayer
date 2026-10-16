import * as v from 'valibot';
import { QuestNpcBindingsSchema } from '@wildshard/format/npcs';
import rows from './questRows.generated.json' with { type: 'json' };

export const QUEST_NPCS = v.parse(QuestNpcBindingsSchema, rows.npcs);
