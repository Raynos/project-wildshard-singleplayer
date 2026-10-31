import * as v from 'valibot';
import type {SimStateAdapter} from '../../src/engine/sim';

const Observation=v.object({version:v.literal(1),slot:v.string(),
  bolts:v.pipe(v.number(),v.finite(),v.integer(),v.minValue(0)),enabled:v.optional(v.boolean(),true)});
export type NalatiWeaponObservation=v.InferOutput<typeof Observation>;

/** Read the existing native owner's public JSON continuation. No command,
 * equipment switch, ammunition grant or borrowed mutable value is involved. */
export function readNalatiWeaponObservation(owner:Pick<SimStateAdapter,'snapshot'>):NalatiWeaponObservation {
  const wire=owner.snapshot();if(typeof wire!=='string')throw new Error('Native weapon observation requires its original JSON envelope');
  const input:unknown=JSON.parse(wire);return v.parse(Observation,input);
}
