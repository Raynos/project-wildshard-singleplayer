import * as v from 'valibot';

/**
 * A shard's declared world entry (G532 phase C): ordered rows the game runs over its admitted world scenes, in named
 * blocks the world build reaches in order. Each row names scene handles and lent looks by id; nothing here is code.
 *   attach  put a published group / mesh / object under the world root (optionally renamed, shadow and user flags)
 *   place   load a named scene placement (its models, draws, colliders and piece)
 *   look    set a lent look's material state (blend factors, depth and coverage flags, transparency)
 * `when` keeps a row to one tier or one world variant (e.g. a deck ending); rows without it always run.
 */
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite());
const when = v.strictObject({ tier: v.exactOptional(v.picklist(['phone', 'desktop'])), variant: v.exactOptional(id) });
/** the material state a look row may set: what three's `Material.setValues` reads for blending, depth and coverage */
const MaterialStateSchema = v.strictObject({
  transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(1))),
  alphaToCoverage: v.exactOptional(v.boolean()), depthWrite: v.exactOptional(v.boolean()), depthTest: v.exactOptional(v.boolean()),
  depthFunc: v.exactOptional(v.pipe(v.number(), v.integer())), blending: v.exactOptional(v.pipe(v.number(), v.integer())),
  blendEquation: v.exactOptional(v.pipe(v.number(), v.integer())), blendEquationAlpha: v.exactOptional(v.pipe(v.number(), v.integer())),
  blendSrc: v.exactOptional(v.pipe(v.number(), v.integer())), blendDst: v.exactOptional(v.pipe(v.number(), v.integer())),
  blendSrcAlpha: v.exactOptional(v.pipe(v.number(), v.integer())), blendDstAlpha: v.exactOptional(v.pipe(v.number(), v.integer())),
});
/** `nameAfter`: name the object after the model an earlier `place` row of this entry placed (its placement id) */
const AttachSchema = v.strictObject({ kind: v.literal('attach'), when: v.exactOptional(when), id, as: v.picklist(['group', 'mesh', 'object']),
  name: v.exactOptional(id), nameAfter: v.exactOptional(id), castShadow: v.exactOptional(v.boolean()), userData: v.exactOptional(v.record(id, v.union([v.boolean(), finite, id]))) });
const PlaceSchema = v.strictObject({ kind: v.literal('place'), when: v.exactOptional(when), id });
const LookSchema = v.strictObject({ kind: v.literal('look'), when: v.exactOptional(when), look: id, state: MaterialStateSchema });
export const WorldEntryStepSchema = v.variant('kind', [AttachSchema, PlaceSchema, LookSchema]);
export const WorldEntrySchema = v.strictObject({ blocks: v.record(id, v.pipe(v.array(WorldEntryStepSchema), v.maxLength(1024))) });
export type WorldEntryStep = v.InferOutput<typeof WorldEntryStepSchema>;
export type WorldEntryRows = v.InferOutput<typeof WorldEntrySchema>;
/** Admit a world entry blob (its product file) before the world build runs any of it. */
export function parseWorldEntry(input: unknown): WorldEntryRows { return v.parse(WorldEntrySchema, input); }
