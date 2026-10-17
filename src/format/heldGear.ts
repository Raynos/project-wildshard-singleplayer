import * as v from 'valibot';
import { HeldFinishCardSchema } from './heldFinishes';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const number = v.pipe(v.number(), v.finite());
/** Explorer identities and live counts for the shared held families. Build callbacks stay in the game host. */
export const HeldGearSchema = v.strictObject({ slug: text,
  cards: v.pipe(v.array(HeldFinishCardSchema), v.maxLength(128)),
  variantOrder: v.pipe(v.array(text), v.maxLength(128)),
  models: v.pipe(v.array(v.strictObject({
    role: v.picklist(['launcher', 'firearm', 'bow', 'bolt', 'arrow', 'tool']),
    id: text, name: text, file: text, onceKey: text,
    pipeline: v.union([v.literal('code'), v.array(v.picklist(['blender', 'code']))]),
    surface: v.exactOptional(v.picklist(['wood', 'metal'])),
    yaw: v.exactOptional(number), placeholder: v.exactOptional(v.tuple([number, number, number])),
    copies: v.pipe(number, v.integer(), v.minValue(0)), drawnAs: v.exactOptional(v.picklist(['single', 'instanced'])),
  })), v.maxLength(32)),
});
/** Data for cold Explorer and the entered shard's held gear roster. */
export type HeldGearRows = v.InferOutput<typeof HeldGearSchema>;
