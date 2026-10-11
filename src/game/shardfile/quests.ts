import type * as v from 'valibot';
import type { QuestDataSchema } from '@wildshard/format/quests';

/** Frozen legacy quest hosts retain this type path; the defining contract is @wildshard/format/quests. */
export type QuestData = v.InferOutput<typeof QuestDataSchema>;
