/** Frozen NPC admission at cf35205ed5ed3529224738b18ca486c998b1b087; independent verdict, output and error-order oracle. */
import * as v from "valibot";

const npcRowName = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const names = v.pipe(v.array(npcRowName), v.maxLength(64));
const npcRowFinite = v.pipe(v.number(), v.finite());
const positive = v.pipe(npcRowFinite, v.minValue(0));
const npcRowPoint = v.strictObject({ x: npcRowFinite, z: npcRowFinite });
const vec3 = v.tuple([npcRowFinite, npcRowFinite, npcRowFinite]);
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });


/** Dialogue data independent of its rendered body. Skinned stand-in NPCs keep their own figure installer. */
export const NpcDialogueRowSchema = v.strictObject({ id: npcRowName, name: text,
  dialogue: v.pipe(v.array(v.strictObject({ when: v.exactOptional(condition), lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)), sets: v.exactOptional(names) })), v.minLength(1), v.maxLength(16)),
});
/** Validated dialogue row; directly consumed by both the page and native NpcDialogue. */
export type NpcDialogueRow = v.InferOutput<typeof NpcDialogueRowSchema>;
/** Validate the dialogue without inventing pivot-figure fields for a skinned NPC. */
export function parseNpcDialogueRow(input: unknown): NpcDialogueRow { return v.parse(NpcDialogueRowSchema, input); }

/** One pivot's turn (radians): `base` plus `swing`·sin(`hz`·t), only the sine's positive half when marked 'half'. */
const npcSwing = v.union([v.tuple([npcRowFinite, npcRowFinite, positive]), v.tuple([npcRowFinite, npcRowFinite, positive, v.literal('half')])]);
/** A pose: the arm's `lift` (the shoulder about z), `forward` (the shoulder about x) and the forearm's `bend` (the elbow about z). */
const npcPose = v.strictObject({ lift: npcSwing, forward: npcSwing, bend: npcSwing });
/**
 * How a pivot NPC moves: whether it `turns` to face the player (within its face range or while it talks; else back to
 * its home facing); whether it waves only until it is met; its arm's easing rate (per second); its breath (a yaw sway
 * and a vertical swell, [amplitude, hz]); and its arm's pose at rest, waving (the player within its wave range) and
 * talking.
 */
export const NpcMotionSchema = v.strictObject({ turns: v.boolean(), waveUntilMet: v.boolean(), ease: positive,
  breathe: v.strictObject({ yaw: v.tuple([npcRowFinite, positive]), scale: v.tuple([npcRowFinite, positive]) }),
  rest: npcPose, wave: npcPose, talk: npcPose });
/** A validated pivot NPC motion row. */
export type NpcMotion = v.InferOutput<typeof NpcMotionSchema>;

/**
 * A quest-giver NPC as a declared row (SHARD-PLATFORM SF27, the pivot-NPC row): who it is, where it stands and what it
 * says, and how its figure moves. The figure is one generated model split onto pivots (not skinned): the head turns at
 * the neck, one arm swings at the shoulder; it faces `faceHome` until the player comes within `faceRange`, waves within
 * `waveRange` until its `metFlag` is raised, and gestures while it talks. Its talk prompt (`spot`, the interaction rows'
 * named spot) stands `talkHeight` over its feet and reaches `talkRadius` from the player's eye. Its first matching
 * dialogue entry is what it says (the engine's NpcDef order).
 */
export const NpcRowSchema = v.strictObject({
  id: npcRowName, name: text, spot: npcRowName, at: npcRowPoint, faceHome: npcRowPoint, metFlag: npcRowName,
  talkHeight: positive, talkRadius: positive, faceRange: positive, waveRange: positive,
  /** the solid column round it (`half` m square, from `below` under its feet to `above` over them); none: it is not solid */
  collider: v.exactOptional(v.strictObject({ half: positive, below: positive, above: positive, surface: v.picklist(['flesh', 'wood', 'metal', 'felt', 'shell', 'earth']) })),
  /**
   * The figure: the model id, fitted to `height` m with its feet on y 0 facing +Z (centred on its footing when `centre`
   * is 'base'); the head is every triangle at or over the neck (no neck: no head pivot); the arm, the triangles with x
   * under `armBelowX + armSlope·y` and y over `armAboveY`, under `armTopY` (else the neck + 0.02); with an `elbow`, the
   * arm's triangles past the plane through `elbow.at` square to `elbow.axis` (x-y) are the forearm on the elbow pivot;
   * the vertex-coloured material's roughness and flat shading (a flat figure's normals are recomputed).
   */
  figure: v.strictObject({ model: npcRowName, height: positive, neck: v.exactOptional(vec3), shoulder: vec3, armBelowX: npcRowFinite, armAboveY: npcRowFinite,
    armSlope: v.exactOptional(npcRowFinite), armTopY: v.exactOptional(npcRowFinite), centre: v.exactOptional(v.picklist(['base'])),
    elbow: v.exactOptional(v.strictObject({ at: vec3, axis: v.tuple([npcRowFinite, npcRowFinite]) })),
    roughness: v.pipe(npcRowFinite, v.minValue(0), v.maxValue(1)), flat: v.boolean() }),
  /** how the figure moves (`NpcMotionSchema`); none: `PIVOT_NPC_MOTION` (plugin/geometry) */
  motion: v.exactOptional(NpcMotionSchema),
  dialogue: NpcDialogueRowSchema.entries.dialogue,
});
/** A validated quest-giver NPC row (`NpcRowSchema`). */
export type NpcRow = v.InferOutput<typeof NpcRowSchema>;
/** Compile an authored NPC row; an unknown field or an empty dialogue refuses. */
export function parseNpcRow(input: unknown): NpcRow { return v.parse(NpcRowSchema, input); }

