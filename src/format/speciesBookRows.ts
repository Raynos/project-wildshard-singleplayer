import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesSchema } from './speciesPrograms';
import { RidingPresentationSchema } from './riding';
import { SkinClipNameSchema } from './skinData';
import { SpeciesGroupSchema, DirectedSpeciesSchema } from './speciesLooks';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
/** Build-only species catalogue admission. Native consumers import row types. */
/** Packed body keys, rig contracts and painterly material measurements. */
const book=v.object({slug:text,body:v.unknown(),poses:v.optional(v.record(text,v.unknown())),program:v.optional(v.unknown()),
  rows:v.pipe(v.array(v.object({metadata:SpeciesSchema,id:text,family:text,
    rigContract:v.object({skeleton:text,clips:v.array(SkinClipNameSchema),sockets:v.array(text)}),
    rig:v.optional(v.picklist(['quadruped','custom'])),pose:v.optional(v.object({grazeNeck:number,gallopTail:number})),gait:v.optional(v.object({trot:number,gallop:number})),
    eyeGlow:v.optional(rgb),eyeGlowIntensity:v.optional(number),
    variants:v.record(text,v.object({body:text,tint:v.optional(v.record(text,rgb)),traits:v.optional(v.record(text,v.union([number,v.boolean()]))) })),
    group: v.optional(SpeciesGroupSchema), directed: v.optional(DirectedSpeciesSchema), guard: v.optional(v.literal(true)),
    /** a named elite: its think / act / damage are the elite page's (game/quest/elitePage) */
    elite: v.optional(v.literal(true)),
    postPose: v.optional(v.strictObject({ alive: text, dead: v.exactOptional(text), envelopes: v.exactOptional(RidingPresentationSchema) })),
    material:v.object({rim:number,bands:number}),
  })),v.maxLength(256)),
});

export const SpeciesLookBookSchema=v.pipe(v.unknown(),v.check(isJsonData),book);
const part=v.tuple([v.number(),v.number(),v.number(),v.array(v.tuple([v.number(),v.number(),v.number()])),v.picklist(['u16','u32'])]);
export const CompactSpeciesBodiesSchema=v.object({file:v.string(),bytes:v.number(),attrs:v.array(v.tuple([v.string(),v.picklist(['f32','u16']),v.number(),v.boolean()])),skeletons:v.array(v.object({bones:v.unknown(),dims:v.unknown()})),
 rows:v.array(v.object({kind:v.string(),variant:v.string(),skeleton:v.number(),fur:v.array(part),hard:v.array(part),eye:v.array(part)}))});
/** Complete packed metadata is checked before the native geometry owner allocates. */
export const NativeSpeciesLookBookSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({...book.entries,body:CompactSpeciesBodiesSchema}));
export type CompactSpeciesBodiesRows=v.InferOutput<typeof CompactSpeciesBodiesSchema>;
export type NativeSpeciesLookBookRows=v.InferOutput<typeof NativeSpeciesLookBookSchema>;
const poseConfig=v.object({prefix:v.string(),group:v.string(),scalars:v.array(v.unknown()),look:v.exactOptional(v.unknown()),alive:v.exactOptional(v.boolean())});
const cracks=v.object({attrs:v.array(v.tuple([v.string(),v.picklist(['f32','u16']),v.number(),v.boolean()])),count:v.number(),index:v.literal('u32'),indexCount:v.number(),box:v.boolean()});
/** The existing named actors file retains its exact body, pose and crack payload. */
export const SpeciesPresentationSchema=v.object({poses:v.record(v.string(),poseConfig),packedBodies:CompactSpeciesBodiesSchema,program:v.unknown(),strike:v.unknown(),lookBook:v.pick(book,['slug','rows','program']),cracks});
export const SpeciesActorsFileSchema=v.looseObject({species:SpeciesPresentationSchema});
export type SpeciesPresentationRows=v.InferOutput<typeof SpeciesPresentationSchema>;
export type SpeciesActorsFileRows=v.InferOutput<typeof SpeciesActorsFileSchema>;
