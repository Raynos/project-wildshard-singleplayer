import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesSchema } from './speciesPrograms';
import { SkinClipNameSchema } from './skinData';
import { NumericPoseSchema } from './clientChannels';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
const fur = v.object({ texSeed: number, tex: v.object({ contrast: number, grizzle: number, normalStrength: number,
  bristle: number, strandLen: number, root: number }), roughness: number, sheen: number, sheenColor: rgb,
  envMapIntensity: number, rim: rgb, shellLen: number, shag: number, emissive: v.exactOptional(rgb), emissiveIntensity: v.exactOptional(number) });
const variantLook = v.object({ tint: v.exactOptional(v.record(text, rgb)), traits: v.exactOptional(v.record(text, number)),
  fur: v.exactOptional(v.object({ rim: v.exactOptional(rgb), sheenColor: v.exactOptional(rgb), emissive: v.exactOptional(rgb), emissiveIntensity: v.exactOptional(number) })) });
/** Immutable species fields and a hull-only rest body; each spawn receives an independent body. */
export const HullSpeciesSchema = v.object({ ...SpeciesSchema.entries, fur,
  variants: v.array(v.object({ ...SpeciesSchema.entries.variants.item.entries, ...variantLook.entries })),
  rigContract: v.object({ skeleton: text, clips: v.array(v.never()), sockets: v.array(text) }),
  pose: v.object({ grazeNeck: number, gallopTail: number }),
  body: v.object({ bones: v.array(v.object({ name: text, parent: v.nullable(text), pos: rgb })),
    furParts: v.array(v.never()), hardParts: v.array(v.never()), eyeParts: v.array(v.never()),
    dims: v.object({ bodyY: number, bodyHalfLen: number, bodyRadius: number, headRadius: number, legLen: number,
      feet: v.array(v.tuple([number, number])), halfWidth: number }) }) });
const dims = v.strictObject({ bodyY: number, bodyHalfLen: number, bodyRadius: number, headRadius: number, legLen: number,
  feet: v.array(v.tuple([number, number])), halfWidth: number, capsuleAxis: v.exactOptional(v.picklist(['z', 'y'])),
  headAt: v.exactOptional(rgb), bodyAt: v.exactOptional(rgb), bodyPitch: v.exactOptional(number),
  fore: v.exactOptional(v.strictObject({ bone: text, at: rgb, halfLen: number, radius: number })) });
/** G571: a species derived from one of the book's definitions: its own fields, its one coat and its custom limb rig (rest
 *  bones and hit volumes, and the limb rig, blend and clip rows `limbAnimation` reads), with two named game rules: think
 *  `external` (an owning fight drives it) and damage `roamingBoss` (the roaming boss's hit rule). */
const DerivedSpeciesSchema = v.strictObject({ from: text, label: text,
  fields: v.strictObject({ aggressive: v.boolean(), blood: v.boolean(), walkSpeed: number, chargeSpeed: number,
    sounds: v.strictObject({ call: text, hurt: text, callEvery: v.tuple([number, number]) }), eyeGlow: rgb, eyeGlowIntensity: number }),
  coat: v.object({ ...SpeciesSchema.entries.variants.item.entries, ...variantLook.entries }),
  rig: v.strictObject({ skeleton: text, sockets: v.array(text), bones: v.array(v.object({ name: text, parent: v.nullable(text), pos: rgb })), dims,
    spec: v.unknown(), blend: v.unknown(), clips: v.unknown() }),
  think: v.literal('external'), damage: v.literal('roamingBoss') });
/** Rigged hull looks compose shared fauna or declared rest bodies with authored coat and joint rows. */
export const HullLookBookSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({ slug: text,
  body: v.exactOptional(v.unknown()), definitions: v.record(text, HullSpeciesSchema), derived: v.optional(v.record(text, DerivedSpeciesSchema), {}), rows: v.pipe(v.array(v.strictObject({
    id: text, species: text, kind: text, base: v.picklist(['boar', 'bear', 'definition', 'registered']),
    required: v.boolean(), variants: v.exactOptional(v.record(text, variantLook)), postPose: v.exactOptional(NumericPoseSchema),
  })), v.maxLength(256)) }));
/** An admitted hull look book (the `look/hull-book` section). */
export type HullLookBookRows = v.InferOutput<typeof HullLookBookSchema>;
/** Client-only rest looks over an admitted packed body and numeric joint poses. */
export const PackedCreatureLooksSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  poses: v.record(text, NumericPoseSchema),
  rows: v.pipe(v.array(v.strictObject({ id: text, species: text, kind: text, skeleton: text,
    sockets: v.array(text), clips: v.array(SkinClipNameSchema), pose: v.exactOptional(text),
    rig: v.exactOptional(v.picklist(['quadruped', 'custom'])), family: v.exactOptional(text), variants: v.exactOptional(v.record(text, text)),
    standMem: v.exactOptional(v.record(text, number)), eyeGlow: v.exactOptional(rgb), eyeGlowIntensity: v.exactOptional(number),
    lift: v.exactOptional(v.tuple([number, number, number, number])),
    // the faceted body's per-facet jitter (0: a painted body's flat facets)
    facetJitter: v.exactOptional(v.pipe(number, v.minValue(0))),
    // a hard front: a blow that lands within `arc` degrees of the heading deals `scale` of its damage (flank it)
    hitArc: v.exactOptional(v.strictObject({ arc: v.pipe(number, v.minValue(0), v.maxValue(180)), scale: v.pipe(number, v.minValue(0)) })),
  })), v.maxLength(256)),
}));
/** A product's creature install (G571): the perch body's poses file, the practice spawn its respawn needs, the packed
 *  and hull-book look kinds in install order, the lent graph bodies each look wears and the population projection. */
export const CreatureInstallSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  perch: text, practice: text, projection: text,
  packed: v.strictObject({ file: text, kinds: v.pipe(v.array(text), v.maxLength(64)) }),
  hulls: v.pipe(v.array(text), v.maxLength(64)),
  // the lent body every look wears; `glowing` for a species with an eye glow; `kinds` a kind's own body
  lent: v.strictObject({ body: text, glowing: text, kinds: v.record(text, text) }),
}));
/** An admitted creature install (`actors/creature-install.json`). */
export type CreatureInstallRows = v.InferOutput<typeof CreatureInstallSchema>;
/** Native group slot binding; 0.1 seconds is the fastest admitted decision cadence. */
export const SpeciesGroupSchema = v.strictObject({ kind: v.picklist(['pack', 'herd']), clock: text,
  every: v.pipe(number, v.minValue(.1), v.maxValue(10)), confine: v.boolean(), observeDamage: v.boolean(),
  held: v.pipe(v.array(text), v.maxLength(16)), damage: v.exactOptional(text),
});
/** A native director's memory targets and the bounded guest's motion projection. */
export const DirectedSpeciesSchema = v.strictObject({ signal: text, clock: text,
  every: v.pipe(number, v.minValue(.1), v.maxValue(10)), target: v.tuple([text, text]), motion: v.tuple([text, text]),
  speed: number, turn: number, threshold: number, stopDistance: number, look: number,
  states: v.pipe(v.array(text), v.minLength(1), v.maxLength(32)),
  damage: v.exactOptional(v.strictObject({ signal: text, player: v.tuple([text, text]), radius: number, scale: number, elite: v.boolean() })),
});
