import * as v from 'valibot';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const names = v.pipe(v.array(name), v.maxLength(64));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const need = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names), else: v.exactOptional(name) });
const row = v.strictObject({
  id: name, act: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), at: name, crack: v.exactOptional(v.picklist(['light', 'heavy'])),
  needs: v.exactOptional(v.pipe(v.array(need), v.maxLength(16))), sets: v.pipe(names, v.minLength(1)),
});
const unique = (list: readonly (string | number)[]): boolean => new Set(list).size === list.length;
const pathKey = v.pipe(name, v.regex(/^[A-Za-z][A-Za-z0-9_-]*$/u), v.check(key => !['constructor', 'prototype', '__proto__', 'caller', 'callee', 'arguments'].includes(key), 'safe borrowed property'));
const ownerPath = v.strictObject({ target: name, owner: name,
  path: v.pipe(v.array(v.union([pathKey, v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1024))])), v.minLength(1), v.maxLength(16)) });
const ownerPaths = v.pipe(v.array(ownerPath), v.maxLength(128), v.check(rows => unique(rows.map(entry => entry.target)), 'unique borrowed targets'));
const ownerCalls = v.pipe(v.array(v.strictObject({ ...ownerPath.entries, optional: v.exactOptional(v.boolean()),
  args: v.exactOptional(v.pipe(v.array(v.union([v.pipe(v.string(), v.maxLength(4096)), v.pipe(v.number(), v.finite()), v.boolean()])), v.maxLength(16))) })),
  v.maxLength(128), v.check(rows => unique(rows.map(entry => entry.target)), 'unique borrowed calls'));
const worldFinite = v.pipe(v.number(), v.finite());
const worldPoint = v.variant('kind', [
  v.strictObject({ kind: v.literal('point'), x: worldFinite, y: worldFinite, z: worldFinite }),
  v.strictObject({ kind: v.literal('owner'), owner: name, path: ownerPath.entries.path }),
]);
const worldReactions = v.pipe(v.array(v.strictObject({ id: name, at: worldPoint,
  radius: v.pipe(worldFinite, v.minValue(0), v.maxValue(100)), needs: v.exactOptional(condition),
  action: v.exactOptional(name), sets: v.exactOptional(names), toast: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))),
  heavy: v.exactOptional(v.boolean()), second: v.exactOptional(v.boolean()), lightHint: v.exactOptional(v.pipe(v.string(), v.maxLength(4096))),
  cone: v.exactOptional(v.strictObject({ reach: v.pipe(worldFinite, v.minValue(0), v.maxValue(100)), halfAngle: v.pipe(worldFinite, v.minValue(0), v.maxValue(Math.PI)) })),
})), v.maxLength(64), v.check(rows => unique(rows.map(entry => entry.id)) && rows.every(entry => entry.action !== undefined || (entry.sets?.length ?? 0) > 0), 'unique world reactions with an accepted effect'));
/** Bounded world hits: borrowed or authored points, existing contact shapes, flag gates and named page actions. */
export type QuestWorldReactionsData = v.InferOutput<typeof worldReactions>;
/** Named schema boundary for optional world reactions. */
export const QuestWorldReactionsSchema: v.GenericSchema<unknown, QuestWorldReactionsData> = worldReactions;
/** Refuse malformed positions, unsafe borrowed paths and unbounded or effect-free reactions. */
export function parseQuestWorldReactions(input: unknown): QuestWorldReactionsData { return v.parse(QuestWorldReactionsSchema, input); }

/**
 * Declared interaction rows (SF72): the transient `marks` an interaction keeps outside the durable flags (a raised well
 * bucket, an oiled bowl), each optionally starting set when its `initial` condition holds on the flags at install; the
 * `rows`, each a prompt or a crack (`crack: 'light' | 'heavy'`) at a named spot (`at`), answering a `script` command whose
 * value is its `act`: its `needs` are checked in order and the first unmet one refuses with its `else` reason, otherwise
 * its `sets` are raised (marks first, then durable flags); and `never`, the mark combinations a restore refuses.
 */
export const InteractionRowsSchema = v.pipe(
  v.strictObject({ marks: v.pipe(v.array(v.strictObject({ id: name, initial: v.exactOptional(condition) })), v.maxLength(256)),
    rows: v.pipe(v.array(row), v.maxLength(256)), never: v.exactOptional(v.pipe(v.array(condition), v.maxLength(64))) }),
  v.check(data => unique(data.marks.map(mark => mark.id)) && unique(data.rows.map(entry => entry.id)) && unique(data.rows.map(entry => entry.act)), 'unique mark ids, row ids and acts'),
);
/** Validated interaction rows (`InteractionRowsSchema`). */
export type InteractionRowsData = v.InferOutput<typeof InteractionRowsSchema>;
/** One declared row. */
export type InteractionRow = InteractionRowsData['rows'][number];
/** Compile authored interaction rows; an unknown field, a duplicate id or act, or an empty `sets` refuses. */
export function parseInteractionRows(input: unknown): InteractionRowsData { return v.parse(InteractionRowsSchema, input); }

const pageText=v.pipe(v.string(),v.maxLength(4096));
const pageEffect=v.variant('kind',[
  v.strictObject({kind:v.literal('label'),target:name,text:pageText}),
  v.strictObject({kind:v.literal('visible'),target:name,value:v.boolean()}),
  v.strictObject({kind:v.literal('call'),target:name}),
  v.strictObject({kind:v.literal('toast'),text:pageText,progress:v.exactOptional(v.strictObject({flags:names,complete:pageText}))}),
  v.strictObject({kind:v.literal('mark'),target:name,value:v.boolean()}),
]);
const pageEffects=v.pipe(v.array(pageEffect),v.maxLength(64));
/** Bounded page presentation over admitted native interaction rules, with borrowed view/command identities. */
const pageRaw=v.pipe(v.strictObject({
  actions:v.pipe(v.array(v.strictObject({id:name,interaction:v.exactOptional(name),
    needs:v.exactOptional(v.pipe(v.array(need),v.maxLength(16))),
    denied:v.exactOptional(v.record(name,pageText)),before:v.exactOptional(pageEffects),after:v.exactOptional(pageEffects)})),v.maxLength(128)),
  world:v.exactOptional(QuestWorldReactionsSchema),
  bindings:v.exactOptional(v.strictObject({ labels:v.exactOptional(ownerPaths), visible:v.exactOptional(ownerPaths),
    observations:v.exactOptional(ownerPaths), calls:v.exactOptional(ownerCalls) })),
  initial:v.exactOptional(v.pipe(v.array(v.strictObject({when:condition,effects:pageEffects})),v.maxLength(64))),
}),v.check(data=>unique(data.actions.map(action=>action.id)),'unique page interaction ids'));
/** Validated page action and restore-view rows; no new durable state is introduced. */
export type QuestPageInteractionsData=v.InferOutput<typeof pageRaw>;
/** Named schema boundary keeps the optional page rows out of recursive shardfile inference. */
export const QuestPageInteractionsSchema:v.GenericSchema<unknown,QuestPageInteractionsData>=pageRaw;
/** Refuse malformed/unknown presentation fields and duplicate actions before any borrowed view is changed. */
export function parseQuestPageInteractions(input:unknown):QuestPageInteractionsData{return v.parse(QuestPageInteractionsSchema,input);}
