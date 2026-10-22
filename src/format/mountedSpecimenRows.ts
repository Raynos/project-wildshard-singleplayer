import * as v from 'valibot';
import { ClipRowsSchema } from './kitFigure';
import { isJsonData } from './json';
import { PrivateSceneSchema } from './clientChannels';
import { SpecimenModelMetadataSchema } from './specimenCatalogue';

const id=v.pipe(v.string(),v.minLength(1)),number=v.pipe(v.number(),v.finite());
/** A look lent to the figure's port material, by look id (G603 L10): the painterly look's rim and bands. */
const SeatLookSchema=v.variant('look',[v.strictObject({look:v.literal('painterly'),id,rim:number,bands:number})]);
/** A rider seated on a mount (G603 L10): the mount's joint, the figure's private scene and clip rows, its geometry as inline
 * fixed-draw rows (key, data, geometry), an optional lent look for a port material (absent, the scene declares its own
 * standard materials), the speed clock and the gestures its cue kinds start. */
export const MountedSpecimenSeatSchema=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({mount:id,figure:PrivateSceneSchema,material:v.exactOptional(SeatLookSchema),
  shapes:v.pipe(v.array(v.strictObject({key:id,data:id,geometry:v.looseObject({})})),v.minLength(1),v.maxLength(8)),
  clips:ClipRowsSchema,speed:id,gestures:v.pipe(v.array(v.strictObject({cue:id,clock:id,duration:v.pipe(number,v.minValue(.01))})),v.maxLength(16))}));
export type MountedSpecimenSeatRows=v.InferOutput<typeof MountedSpecimenSeatSchema>;
/** A mounted specimen (G603 L10): its model card, the product (slug) and file of its seat rows, the species rig and variant
 * it sits on, and the rig's fur tint (0..1). */
export const MountedSpecimenSchema=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({model:SpecimenModelMetadataSchema,slug:id,json:id,
  species:id,variant:id,tint:v.pipe(number,v.minValue(0),v.maxValue(1))}));
