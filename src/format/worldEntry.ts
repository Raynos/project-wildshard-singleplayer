import * as v from 'valibot';

/**
 * A shard's declared world entry (G532 phase C): ordered rows the game runs over its admitted world scenes, in named
 * blocks the world build reaches in order. Each row names scene handles and lent looks by id; nothing here is code.
 *   attach  put a published group / mesh / object under the world root (optionally renamed, shadow and user flags)
 *   place   load a named scene placement (its models, draws, colliders and piece)
 *   look    set a lent look's material state (blend factors, depth and coverage flags, transparency)
 *   piece   register a world piece: colliders, floor rects and the scene object it stands for (G3)
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
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const FloorRectSchema = v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), y: finite,
  rot: v.exactOptional(finite), slope: v.exactOptional(finite), tilt: v.exactOptional(finite), profile: v.exactOptional(v.pipe(v.array(v.tuple([finite, finite, finite])), v.maxLength(8))) });
/** register one world piece: its box / tread colliders (each with its surface), its floor rects (`first` keeps authored
 *  priority, `highest` the top surface) and the scene object it stands for (absent: the world root) */
const PieceSchema = v.strictObject({ kind: v.literal('piece'), when: v.exactOptional(when), id, name: id, file: id,
  category: v.picklist(['ground', 'nature', 'buildings', 'props']), surface, colliders: v.pipe(v.array(v.unknown()), v.maxLength(2048)),
  floors: v.pipe(v.array(FloorRectSchema), v.maxLength(4096)), floorPolicy: v.picklist(['first', 'highest']), solidFloor: v.boolean(), object: v.exactOptional(id) });
export const WorldEntryStepSchema = v.variant('kind', [AttachSchema, PlaceSchema, LookSchema, PieceSchema]);
export const WorldEntrySchema = v.strictObject({ blocks: v.record(id, v.pipe(v.array(WorldEntryStepSchema), v.maxLength(1024))) });
export type WorldEntryStep = v.InferOutput<typeof WorldEntryStepSchema>;
export type WorldEntryRows = v.InferOutput<typeof WorldEntrySchema>;
/** Admit a world entry blob (its product file) before the world build runs any of it. */
export function parseWorldEntry(input: unknown): WorldEntryRows { return v.parse(WorldEntrySchema, input); }
