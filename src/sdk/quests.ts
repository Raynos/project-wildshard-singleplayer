import * as v from 'valibot';
import { parsePersistedQuestPage as parsePage, type PersistedQuestPage } from '@wildshard/format/questStory';
import { QuestDataSchema as schema, parseQuestData as parseData, type QuestData as Data } from '@wildshard/format/quests';
import { parseNativeQuestComposition } from '@wildshard/format/nativeQuestComposition';

/** Compile declared quest graphs and dialogue trees with bounded, serialisable script hook names. */
export const QuestDataSchema: v.SchemaWithPipe<readonly [typeof schema]> = v.pipe(schema);
/** Validated quest/dialogue declarations consumed by the platform runtime. */
export type QuestData = Data;
/** Compile TypeScript author data after checking declared flags and graph references. */
export function parseQuestData(input: unknown): Data { return parseData(input); }

/** Admit generated page policy for the shared saved-quest presenter. */
export function parsePersistedQuestPage(input: unknown): PersistedQuestPage { return parsePage(input); }

/** Admit native quest resource ownership and its defining cross-row checks without creating a page. */
export function nativeQuestCompositionRows(input: unknown): ReturnType<typeof parseNativeQuestComposition> { return parseNativeQuestComposition(input); }
