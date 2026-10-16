import * as v from 'valibot';

const id = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0x7fffffff));
const finite = v.pipe(v.number(), v.finite());
/** Bounded sim-to-view data. No module memory, functions or private decision slots cross the boundary. */
export const DecisionPublicationSchema = v.strictObject({
  tick: id,
  fields: v.pipe(v.array(v.strictObject({ actor: id, field: id, value: finite })), v.maxLength(240000)),
  channels: v.pipe(v.array(v.strictObject({ channel: id, value: finite })), v.maxLength(512)),
  events: v.pipe(v.array(v.strictObject({ kind: v.picklist(['move', 'strike', 'cue']), actor: id, id, target: id })), v.maxLength(16384)),
});
/** One committed fixed-step publication, detached from the simulation's mutable storage. */
export type DecisionPublication = v.InferOutput<typeof DecisionPublicationSchema>;
