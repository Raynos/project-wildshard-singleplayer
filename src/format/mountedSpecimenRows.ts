import * as v from 'valibot';
import { ClipRowsSchema } from './kitFigure';
import { isJsonData } from './json';
import { PrivateSceneSchema } from './clientChannels';

const id=v.pipe(v.string(),v.minLength(1)),number=v.pipe(v.number(),v.finite());
/** The named figure retains its existing scene/material and optional clip bytes; its geometry is inline shape-book rows. */
export const MountedSpecimenSeatSchema=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({mount:id,figure:PrivateSceneSchema,material:v.strictObject({id,rim:number,bands:number}),
  shapes:v.pipe(v.array(v.strictObject({key:id,data:id,geometry:v.looseObject({})})),v.minLength(1),v.maxLength(8)),
  clips:ClipRowsSchema,speed:id,gestures:v.pipe(v.array(v.strictObject({cue:id,clock:id,duration:v.pipe(number,v.minValue(.01))})),v.maxLength(16))}));
export type MountedSpecimenSeatRows=v.InferOutput<typeof MountedSpecimenSeatSchema>;
