/** Bounded cell storage and numeric guest bindings, independent of any arena law. */
import * as v from 'valibot';
import { EncounterScheduleSchema } from './encounterRows';

const finite = v.pipe(v.number(),v.finite());
const count = v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(64));
const offset = v.pipe(finite,v.integer(),v.minValue(-1),v.maxValue(1));
const name = v.pipe(v.string(),v.minLength(1),v.maxLength(64),v.regex(/^[A-Za-z][A-Za-z0-9_]*$/));
const state = v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(255));
/** The host supplies x/z, dt/count and neighbour cell/x/z. Every law-specific
 * state code, scalar channel and event name is explicit data. */
export const CellFieldSchema = v.strictObject({
  x: finite,z: finite,width: count,depth: count,cell: v.pipe(finite,v.minValue(.01)),
  observations: v.pipe(v.record(name,finite),v.maxEntries(32)),
  states: v.strictObject({ idle: state,active: state,spent: state }),
  channels: v.strictObject({ state: name,lifetime: name,clock: name,pulse: name,neighbours: name }),
  neighbours: v.pipe(v.array(v.tuple([offset,offset])),v.maxLength(8)),
  signals: v.strictObject({ activate: name,step: name,clock: name }),
  contact: v.optional(v.strictObject({ law: EncounterScheduleSchema,
    samples: v.pipe(v.array(v.strictObject({ x: finite,z: finite })),v.maxLength(8)) })),
});
export type CellFieldRows = v.InferOutput<typeof CellFieldSchema>;
