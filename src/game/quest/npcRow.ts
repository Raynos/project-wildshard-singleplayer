import * as v from 'valibot';
import type { NpcDef } from '@wildshard/engine/quest/core';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const names = v.pipe(v.array(name), v.maxLength(64));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
const point = v.strictObject({ x: finite, z: finite });
const vec3 = v.tuple([finite, finite, finite]);
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });

/**
 * A quest-giver NPC as a declared row (SHARD-PLATFORM SF27, the pivot-NPC row): who it is, where it stands and what it
 * says, and how its figure moves. The figure is one generated model split onto pivots (not skinned): the head turns at
 * the neck, one arm swings at the shoulder; it faces `faceHome` until the player comes within `faceRange`, waves within
 * `waveRange` until its `metFlag` is raised, and gestures while it talks. Its talk prompt (`spot`, the interaction rows'
 * named spot) stands `talkHeight` over its feet and reaches `talkRadius` from the player's eye. Its first matching
 * dialogue entry is what it says (the engine's NpcDef order).
 */
export const NpcRowSchema = v.strictObject({
  id: name, name: text, spot: name, at: point, faceHome: point, metFlag: name,
  talkHeight: positive, talkRadius: positive, faceRange: positive, waveRange: positive,
  /** the solid column round it (`half` m square, from `below` under its feet to `above` over them) */
  collider: v.strictObject({ half: positive, below: positive, above: positive, surface: v.picklist(['flesh', 'wood', 'metal', 'felt', 'shell', 'earth']) }),
  /**
   * The figure: the model id, fitted to `height` m with its feet on y 0 facing +Z; the head is every triangle at or
   * over the neck; the arm, the triangles with x under `armBelowX` and y over `armAboveY` up to the neck; the material's
   * roughness and flat shading.
   */
  figure: v.strictObject({ model: name, height: positive, neck: vec3, shoulder: vec3, armBelowX: finite, armAboveY: finite,
    roughness: v.pipe(finite, v.minValue(0), v.maxValue(1)), flat: v.boolean() }),
  dialogue: v.pipe(v.array(v.strictObject({ when: v.exactOptional(condition), lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)), sets: v.exactOptional(names) })), v.minLength(1), v.maxLength(16)),
});
/** A validated quest-giver NPC row (`NpcRowSchema`). */
export type NpcRow = v.InferOutput<typeof NpcRowSchema>;
/** Compile an authored NPC row; an unknown field or an empty dialogue refuses. */
export function parseNpcRow(input: unknown): NpcRow { return v.parse(NpcRowSchema, input); }

/** The engine's NpcDef for the row's talk: its dialogue entries in order (the first whose condition holds is said). */
export function npcDef(row: NpcRow): NpcDef {
  return { id: row.id, name: row.name, dialogue: row.dialogue.map(entry => ({
    ...(entry.when === undefined ? {} : { when: { ...entry.when } }), lines: [...entry.lines], ...(entry.sets === undefined ? {} : { sets: [...entry.sets] }) })) };
}
/** The row's talk spot over the ground: its head's height and its prompt's reach (the interaction rows' spot). */
export function npcSpot(row: NpcRow, groundAt: (x: number, z: number) => number): { x: number; y: number; z: number; radius: number } {
  return { x: row.at.x, y: groundAt(row.at.x, row.at.z) + row.talkHeight, z: row.at.z, radius: row.talkRadius };
}
