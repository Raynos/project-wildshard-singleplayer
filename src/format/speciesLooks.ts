import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesSchema } from './speciesPrograms';
import { RidingPresentationSchema } from './riding';
import { SkinClipNameSchema } from './skinData';
import { NumericPoseSchema } from './clientChannels';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
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
  damage: v.exactOptional(v.strictObject({ signal: text, player: v.tuple([text, text]), radius: number, scale: number, coupled: v.boolean(), elite: v.boolean() })),
});
/** Packed body keys, rig contracts and painterly material measurements. */
export const SpeciesLookBookSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({slug:text,body:v.unknown(),poses:v.optional(v.record(text,v.unknown())),program:v.optional(v.unknown()),
  rows:v.pipe(v.array(v.object({metadata:SpeciesSchema,id:text,family:text,
    rigContract:v.object({skeleton:text,clips:v.array(SkinClipNameSchema),sockets:v.array(text)}),
    rig:v.optional(v.picklist(['quadruped','custom'])),pose:v.optional(v.object({grazeNeck:number,gallopTail:number})),gait:v.optional(v.object({trot:number,gallop:number})),
    eyeGlow:v.optional(rgb),eyeGlowIntensity:v.optional(number),
    variants:v.record(text,v.object({body:text,tint:v.optional(v.record(text,rgb)),traits:v.optional(v.record(text,v.union([number,v.boolean()]))) })),
    group: v.optional(SpeciesGroupSchema), directed: v.optional(DirectedSpeciesSchema), guard: v.optional(v.literal(true)),
    postPose: v.optional(v.strictObject({ alive: text, dead: v.exactOptional(text), envelopes: v.exactOptional(RidingPresentationSchema) })),
    material:v.object({rim:number,bands:number}),
  })),v.maxLength(256)),
}));
