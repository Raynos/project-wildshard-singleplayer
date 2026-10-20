import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesSchema } from './speciesPrograms';
import { SkinClipNameSchema } from './skinData';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
/** Packed body keys, rig contracts and painterly material measurements. */
export const SpeciesLookBookSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({slug:text,body:v.unknown(),
  rows:v.pipe(v.array(v.object({metadata:SpeciesSchema,id:text,family:text,
    rigContract:v.object({skeleton:text,clips:v.array(SkinClipNameSchema),sockets:v.array(text)}),
    rig:v.optional(v.picklist(['quadruped','custom'])),pose:v.optional(v.object({grazeNeck:number,gallopTail:number})),gait:v.optional(v.object({trot:number,gallop:number})),
    eyeGlow:v.optional(rgb),eyeGlowIntensity:v.optional(number),
    variants:v.record(text,v.object({body:text,tint:v.optional(v.record(text,rgb)),traits:v.optional(v.record(text,v.union([number,v.boolean()]))) })),
    material:v.object({rim:number,bands:number}),
  })),v.maxLength(256)),
}));
