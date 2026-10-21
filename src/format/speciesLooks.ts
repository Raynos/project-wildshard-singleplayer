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
/** Rigged hull looks compose shared fauna or declared rest bodies with authored coat and joint rows. */
export const HullLookBookSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({ slug: text,
  body: v.exactOptional(v.unknown()), definitions: v.record(text, HullSpeciesSchema), rows: v.pipe(v.array(v.strictObject({
    id: text, species: text, kind: text, base: v.picklist(['boar', 'bear', 'definition', 'registered']),
    required: v.boolean(), variants: v.exactOptional(v.record(text, variantLook)), postPose: v.exactOptional(NumericPoseSchema),
  })), v.maxLength(256)) }));
/** Client-only rest looks over an admitted packed body and numeric joint poses. */
export const PackedCreatureLooksSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  poses: v.record(text, NumericPoseSchema),
  rows: v.pipe(v.array(v.strictObject({ id: text, species: text, kind: text, skeleton: text,
    sockets: v.array(text), clips: v.array(SkinClipNameSchema), pose: v.exactOptional(text),
    rig: v.exactOptional(v.picklist(['quadruped', 'custom'])), family: v.exactOptional(text), variants: v.exactOptional(v.record(text, text)),
    standMem: v.exactOptional(v.record(text, number)), eyeGlow: v.exactOptional(rgb), eyeGlowIntensity: v.exactOptional(number),
    lift: v.exactOptional(v.tuple([number, number, number, number])),
  })), v.maxLength(256)),
}));
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
