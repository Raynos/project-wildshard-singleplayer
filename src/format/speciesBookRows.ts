import * as v from 'valibot';
import { isJsonData } from './json';
import { SpeciesSchema } from './speciesPrograms';
import { RidingPresentationSchema } from './riding';
import { CreatureStrikeSchema } from './creatures';
import { SkinClipNameSchema } from './skinData';
import { SpeciesGroupSchema, DirectedSpeciesSchema } from './speciesLooks';

const guestNumber=v.pipe(v.number(),v.finite()),key=v.pipe(v.string(),v.minLength(1),v.maxLength(96),v.check(value=>!['__proto__','prototype','constructor'].includes(value)));
/** The admitted guest owns every decision. Rows specify observation defaults,
 * retained outputs and native contact/presentation resources. */
export const CreatureGuestSchema=v.pipe(v.unknown(),v.check(isJsonData),v.object({
  program:v.unknown(),clock:key,playerKeys:v.tuple([key,key]),
  memory:v.pipe(v.record(key,v.object({value:guestNumber,source:v.optional(v.picklist(['x','z','yaw'])),
    when:v.optional(v.object({field:key,equal:guestNumber,value:guestNumber}))})),v.maxEntries(64)),
  writes:v.pipe(v.array(key),v.maxLength(64)),states:v.pipe(v.array(key),v.maxLength(32)),sounds:v.pipe(v.array(v.string()),v.maxLength(32)),
  attack:v.pipe(guestNumber,v.minValue(0)),strike:CreatureStrikeSchema,strikeSound:v.string(),length:v.tuple([guestNumber,v.pipe(guestNumber,v.minValue(.000001)),guestNumber]),
  piercing:v.object({legacy:key,tags:v.pipe(v.array(key),v.maxLength(16)),equipment:v.pipe(v.array(key),v.maxLength(16))}),
}));
export type CreatureGuestRows=v.InferOutput<typeof CreatureGuestSchema>;

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
export const SpeciesPresentationSchema=v.object({poses:v.record(v.string(),poseConfig),packedBodies:CompactSpeciesBodiesSchema,guest:CreatureGuestSchema,lookBook:v.pick(book,['slug','rows','program']),cracks});
const bodyWhole=v.pipe(number,v.integer(),v.minValue(0));
export const SpeciesActorsFileSchema=v.strictObject({species:SpeciesPresentationSchema,
  page:v.strictObject({world:v.unknown(),specimen:v.unknown()}),
  row:v.strictObject({attrs:v.array(v.tuple([v.string(),v.literal('f32'),bodyWhole,v.boolean()])),count:bodyWhole,
    index:v.nullable(v.picklist(['u16','u32'])),indexCount:bodyWhole,box:v.boolean()}),
  pivots:v.pipe(v.array(v.tuple([number,number,number])),v.maxLength(32)),
  parts:v.pipe(v.array(v.string()),v.maxLength(32)),radius:number,
});
export type SpeciesPresentationRows=v.InferOutput<typeof SpeciesPresentationSchema>;
export type SpeciesActorsFileRows=v.InferOutput<typeof SpeciesActorsFileSchema>;
