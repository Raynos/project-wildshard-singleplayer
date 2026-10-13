import * as v from 'valibot';

const questGraphName = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
/**
 * A quest graph's runtime row (SHARD-PLATFORM SF27): the `script` command actor that carries its interaction rows, the
 * fixed-step id of their marks' continuation, and its `actions`, the beats a row's run starts beyond its flags (today
 * `summon`: the named boss encounter is armed, as a signal fire calls a boss up). Lighting a brazier and cracking a lever
 * are the interaction rows' own crack rows (`crack: 'light' | 'heavy'`).
 */
export const QuestGraphSchema = v.strictObject({
  actor: questGraphName, step: questGraphName,
  actions: v.pipe(v.array(v.strictObject({ row: questGraphName, summon: questGraphName })), v.maxLength(64)),
});
/** A validated quest graph runtime row (`QuestGraphSchema`). */
export type QuestGraphRow = v.InferOutput<typeof QuestGraphSchema>;
/** Compile an authored quest graph runtime row; an unknown field refuses. */
export function parseQuestGraph(input: unknown): QuestGraphRow { return v.parse(QuestGraphSchema, input); }

