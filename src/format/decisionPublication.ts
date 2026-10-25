import * as v from 'valibot';

const id = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0x7fffffff));
const finite = v.pipe(v.number(), v.finite());
/** Bounded sim-to-view data. No module memory, functions or private decision slots cross the boundary. */
export const DecisionPublicationSchema: v.GenericSchema<DecisionPublicationInput, DecisionPublication> = v.strictObject({
  tick: id,
  fields: v.pipe(v.array(v.strictObject({ actor: id, field: id, value: finite })), v.maxLength(240000)),
  channels: v.pipe(v.array(v.strictObject({ channel: id, value: finite })), v.maxLength(512)),
  events: v.pipe(v.array(v.strictObject({ kind: v.picklist(['move', 'strike', 'cue']), actor: id, id, target: id })), v.maxLength(16384)),
});
/** One committed fixed-step publication, detached from the simulation's mutable storage. */


/** Admitted data contracts, independent of validator implementation metadata. */
export type DecisionPublicationInput = DecisionPublication;
interface DecisionPublicationFields {
    tick: number;
    fields: ({
        actor: number;
        field: number;
        value: number;
    })[];
    channels: ({
        channel: number;
        value: number;
    })[];
    events: ({
        kind: 'move' | 'strike' | 'cue';
        actor: number;
        id: number;
        target: number;
    })[];
}
export type DecisionPublication = { [Key in keyof DecisionPublicationFields]: DecisionPublicationFields[Key] };
