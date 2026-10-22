import * as v from 'valibot';
import { isJsonData } from './json';
import { LootBagSchema } from './lootBag';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/** Client-only continuation over entered quest and collection owners. Every
 * model, economy and scheduling choice is an admitted data identity. */
export const QuestContinuationSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Quest continuation requires JSON rows'), v.strictObject({
  quest: id, collection: id,
  collections: v.pipe(id, v.regex(/^[a-zA-Z0-9_./-]+$/u)),
  cosmetics: v.strictObject({ file: id, models: v.pipe(v.record(id, id), v.maxEntries(32)) }),
  loot: v.strictObject({ bag: v.exactOptional(LootBagSchema), id, shop: id, minimap: v.boolean(), before: v.pipe(v.array(id), v.maxLength(64)) }),
}));

/** Read standalone rows or the fixed resource field of an admitted quest page.
 * The field is compiled here; documents cannot provide a selector or callback. */
export function parseQuestContinuationDocument(input: unknown): v.InferOutput<typeof QuestContinuationSchema> {
  const rows = v.parse(v.pipe(v.unknown(), v.check(isJsonData, 'Quest document requires JSON rows'), v.union([
    QuestContinuationSchema, v.object({ entryResources: v.object({ continuation: QuestContinuationSchema }) }),
  ])), input);
  return 'entryResources' in rows ? rows.entryResources.continuation : rows;
}
