import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_.:-]{0,255}$/u));
const n = v.pipe(v.number(), v.finite());
const anchor = v.strictObject({ x: n, y: n, z: n, yaw: n });
/** Build-time POI facts, translated into their authored world frame once.
 * A live flock remains an entered typed loan, never JSON or a property path. */
export const QuestWorldSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Quest world requires JSON rows'), v.strictObject({
  id, pois: v.pipe(v.record(id, v.nullable(v.strictObject({ anchors: v.pipe(v.record(id, anchor), v.maxEntries(1024)) }))), v.maxEntries(256)),
}));
export type QuestWorldRows = v.InferOutput<typeof QuestWorldSchema>;

/** Read standalone rows or the fixed resource field of an admitted quest page.
 * The field is compiled here; documents cannot provide a selector or callback. */
export function parseQuestWorldDocument(input: unknown): QuestWorldRows {
  const rows = v.parse(v.pipe(v.unknown(), v.check(isJsonData, 'Quest document requires JSON rows'), v.union([
    QuestWorldSchema, v.object({ entryResources: v.object({ world: QuestWorldSchema }) }),
  ])), input);
  return 'entryResources' in rows ? rows.entryResources.world : rows;
}
