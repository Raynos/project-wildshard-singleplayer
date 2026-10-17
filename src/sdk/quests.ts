import * as v from 'valibot';
import { parsePersistedQuestPage as parsePage, type PersistedQuestPage } from '@wildshard/format/questStory';
import { QuestDataSchema as schema, parseQuestData as parseData, type QuestData as Data } from '@wildshard/format/quests';

/** Compile declared quest graphs and dialogue trees with bounded, serialisable script hook names. */
export const QuestDataSchema = v.pipe(schema);
/** Validated quest/dialogue declarations consumed by the platform runtime. */
export type QuestData = Data;
/** Compile TypeScript author data after checking declared flags and graph references. */
export function parseQuestData(input: unknown): Data { return parseData(input); }

/** Admit generated page policy for the shared saved-quest presenter. */
export function parsePersistedQuestPage(input: unknown): PersistedQuestPage { return parsePage(input); }
