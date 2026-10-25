import * as v from 'valibot';
import { isJsonData } from './json';
import { ActorProjectionV2Schema } from './actorProjectionV2';
import { SpeciesSchema } from './speciesPrograms';
import { FixedDrawRowsSchema } from './fixedDraws';
import { RidingPresentationSchema } from './riding';
import { CreatureStrikeSchema } from './creatures';
import { SkinClipNameSchema } from './skinData';
import { SpeciesGroupSchema, DirectedSpeciesSchema, CompactSpeciesBodiesSchema } from './speciesLooks';

const guestNumber=v.pipe(v.number(),v.finite()),key=v.pipe(v.string(),v.minLength(1),v.maxLength(96),v.check(value=>!['__proto__','prototype','constructor'].includes(value)));
/** The admitted guest owns every decision. Rows specify observation defaults,
 * retained outputs and native contact/presentation resources. */
export const CreatureGuestSchema: v.GenericSchema<CreatureGuestRowsInput, CreatureGuestRows> =v.pipe(v.unknown(),v.check(isJsonData),v.object({
  program:v.unknown(),clock:key,playerKeys:v.tuple([key,key]),
  memory:v.pipe(v.record(key,v.object({value:guestNumber,source:v.optional(v.picklist(['x','z','yaw'])),
    when:v.optional(v.object({field:key,equal:guestNumber,value:guestNumber}))})),v.maxEntries(64)),
  writes:v.pipe(v.array(key),v.maxLength(64)),states:v.pipe(v.array(key),v.maxLength(32)),sounds:v.pipe(v.array(v.string()),v.maxLength(32)),
  attack:v.pipe(guestNumber,v.minValue(0)),strike:CreatureStrikeSchema,strikeSound:v.string(),length:v.tuple([guestNumber,v.pipe(guestNumber,v.minValue(.000001)),guestNumber]),
  piercing:v.object({legacy:key,tags:v.pipe(v.array(key),v.maxLength(16)),equipment:v.pipe(v.array(key),v.maxLength(16))}),
}));


const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
/** A species borrows its existing arena-room brain; initialization is finite
 * ordered data, before the same original think/act/damage slots. */
export const ArenaRoomSpeciesControlSchema: v.GenericSchema<ArenaRoomSpeciesControlRowsInput, ArenaRoomSpeciesControlRows> =v.strictObject({kind:v.literal('arena-room'),
  initialize:v.strictObject({flag:key,defaults:v.pipe(v.array(v.variant('source',[
    v.strictObject({field:key,source:v.literal('value'),value:number}),
    v.strictObject({field:key,source:v.literal('height')}),
  ])),v.maxLength(64))}),
});

/** Build-only species catalogue admission. Native consumers import row types. */
/** Packed body keys, rig contracts and painterly material measurements. */
const book=v.object({slug:text,body:v.unknown(),poses:v.optional(v.record(text,v.unknown())),program:v.optional(v.unknown()),
  rows:v.pipe(v.array(v.object({metadata:SpeciesSchema,id:text,family:text,
    rigContract:v.object({skeleton:text,clips:v.array(SkinClipNameSchema),sockets:v.array(text)}),
    rig:v.optional(v.picklist(['quadruped','custom'])),pose:v.optional(v.object({grazeNeck:number,gallopTail:number})),gait:v.optional(v.object({trot:number,gallop:number})),
    eyeGlow:v.optional(rgb),eyeGlowIntensity:v.optional(number),
    variants:v.record(text,v.object({body:text,tint:v.optional(v.record(text,rgb)),traits:v.optional(v.record(text,v.union([number,v.boolean()]))) })),
    projection:v.exactOptional(ActorProjectionV2Schema),control:v.exactOptional(ArenaRoomSpeciesControlSchema),
    group: v.optional(SpeciesGroupSchema), directed: v.optional(DirectedSpeciesSchema), guard: v.optional(v.literal(true)),
    /** a named elite: its think / act / damage are the elite page's (game/quest/elitePage) */
    elite: v.optional(v.literal(true)),
    postPose: v.optional(v.strictObject({ alive: text, dead: v.exactOptional(text), envelopes: v.exactOptional(RidingPresentationSchema) })),
    material:v.object({rim:number,bands:number}),
  })),v.maxLength(256)),
});

export const SpeciesLookBookSchema: v.GenericSchema<SpeciesLookBookRowsInput, SpeciesLookBookRows> =v.pipe(v.unknown(),v.check(isJsonData),book);
/** Complete packed metadata is checked before the native geometry owner allocates. */
export const NativeSpeciesLookBookSchema: v.GenericSchema<NativeSpeciesLookBookRowsInput, NativeSpeciesLookBookRows> =v.pipe(v.unknown(),v.check(isJsonData),v.object({...book.entries,body:CompactSpeciesBodiesSchema}));

const poseConfig=v.object({prefix:v.string(),group:v.string(),scalars:v.array(v.unknown()),look:v.exactOptional(v.unknown()),alive:v.exactOptional(v.boolean())});
/** The existing named actors file retains its exact body and pose payload. */
export const SpeciesPresentationSchema: v.ObjectSchema<{
  readonly poses: v.GenericSchema<SpeciesPresentationRowsInput['poses'], SpeciesPresentationRows['poses']>;
  readonly packedBodies: typeof CompactSpeciesBodiesSchema;
  readonly guest: typeof CreatureGuestSchema;
  readonly lookBook: v.GenericSchema<SpeciesPresentationRowsInput['lookBook'], SpeciesPresentationRows['lookBook']>;
}, undefined> =v.object({poses:v.record(v.string(),poseConfig),packedBodies:CompactSpeciesBodiesSchema,guest:CreatureGuestSchema,lookBook:v.pick(book,['slug','rows','program'])});
export const SpeciesActorsFileSchema: v.GenericSchema<SpeciesActorsFileRowsInput, SpeciesActorsFileRows> =v.strictObject({species:SpeciesPresentationSchema,
  page:v.strictObject({world:v.unknown(),specimen:v.unknown()}),
  draws:v.pipe(FixedDrawRowsSchema,v.length(1)),
  pivots:v.pipe(v.array(v.tuple([number,number,number])),v.maxLength(32)),
  parts:v.pipe(v.array(v.string()),v.maxLength(32)),radius:number,
});



/** Admitted species data, independent of validator implementation metadata. */
export type CreatureGuestRowsInput = unknown;
export interface CreatureGuestRows { program: unknown; clock: string; playerKeys: [string, string]; memory: Record<string, { value: number; source?: 'x' | 'z' | 'yaw' | undefined; when?: { field: string; equal: number; value: number; } | undefined; }>; writes: (string)[]; states: (string)[]; sounds: (string)[]; attack: number; strike: v.InferOutput<typeof CreatureStrikeSchema>; strikeSound: string; length: [number, number, number]; piercing: { legacy: string; tags: (string)[]; equipment: (string)[]; }; }
export type ArenaRoomSpeciesControlRowsInput = ArenaRoomSpeciesControlRows;
export interface ArenaRoomSpeciesControlRows { kind: 'arena-room'; initialize: { flag: string; defaults: (({ field: string; source: 'value'; value: number; }) | ({ field: string; source: 'height'; }))[]; }; }
export type SpeciesLookBookRowsInput = unknown;
export interface SpeciesLookBookRows { slug: string; body: unknown; poses?: Record<string, unknown> | undefined; program?: unknown; rows: ({ metadata: v.InferOutput<typeof SpeciesSchema>; id: string; family: string; rigContract: { skeleton: string; clips: (v.InferOutput<typeof SkinClipNameSchema>)[]; sockets: (string)[]; }; rig?: 'quadruped' | 'custom' | undefined; pose?: { grazeNeck: number; gallopTail: number; } | undefined; gait?: { trot: number; gallop: number; } | undefined; eyeGlow?: [number, number, number] | undefined; eyeGlowIntensity?: number | undefined; variants: Record<string, { body: string; tint?: Record<string, [number, number, number]> | undefined; traits?: Record<string, (number) | (boolean)> | undefined; }>; projection?: v.InferOutput<typeof ActorProjectionV2Schema>; control?: ArenaRoomSpeciesControlRows; group?: v.InferOutput<typeof SpeciesGroupSchema> | undefined; directed?: v.InferOutput<typeof DirectedSpeciesSchema> | undefined; guard?: true | undefined; elite?: true | undefined; postPose?: { alive: string; dead?: string; envelopes?: v.InferOutput<typeof RidingPresentationSchema>; } | undefined; material: { rim: number; bands: number; }; })[]; }
export type NativeSpeciesLookBookRowsInput = unknown;
export type NativeSpeciesLookBookRows = { body: v.InferOutput<typeof CompactSpeciesBodiesSchema>; } & { slug: string; body: unknown; poses?: Record<string, unknown> | undefined; program?: unknown; rows: ({ metadata: v.InferOutput<typeof SpeciesSchema>; id: string; family: string; rigContract: { skeleton: string; clips: (v.InferOutput<typeof SkinClipNameSchema>)[]; sockets: (string)[]; }; rig?: 'quadruped' | 'custom' | undefined; pose?: { grazeNeck: number; gallopTail: number; } | undefined; gait?: { trot: number; gallop: number; } | undefined; eyeGlow?: [number, number, number] | undefined; eyeGlowIntensity?: number | undefined; variants: Record<string, { body: string; tint?: Record<string, [number, number, number]> | undefined; traits?: Record<string, (number) | (boolean)> | undefined; }>; projection?: v.InferOutput<typeof ActorProjectionV2Schema>; control?: ArenaRoomSpeciesControlRows; group?: v.InferOutput<typeof SpeciesGroupSchema> | undefined; directed?: v.InferOutput<typeof DirectedSpeciesSchema> | undefined; guard?: true | undefined; elite?: true | undefined; postPose?: { alive: string; dead?: string; envelopes?: v.InferOutput<typeof RidingPresentationSchema>; } | undefined; material: { rim: number; bands: number; }; })[]; };
export interface SpeciesPresentationRowsInput { poses: Record<string, { prefix: string; group: string; scalars: (unknown)[]; look?: unknown; alive?: boolean; }>; packedBodies: v.InferInput<typeof CompactSpeciesBodiesSchema>; guest: CreatureGuestRowsInput; lookBook: Pick<{ slug: string; body: unknown; poses?: Record<string, unknown> | undefined; program?: unknown; rows: ({ metadata: v.InferInput<typeof SpeciesSchema>; id: string; family: string; rigContract: { skeleton: string; clips: (v.InferInput<typeof SkinClipNameSchema>)[]; sockets: (string)[]; }; rig?: 'quadruped' | 'custom' | undefined; pose?: { grazeNeck: number; gallopTail: number; } | undefined; gait?: { trot: number; gallop: number; } | undefined; eyeGlow?: [number, number, number] | undefined; eyeGlowIntensity?: number | undefined; variants: Record<string, { body: string; tint?: Record<string, [number, number, number]> | undefined; traits?: Record<string, (number) | (boolean)> | undefined; }>; projection?: v.InferInput<typeof ActorProjectionV2Schema>; control?: ArenaRoomSpeciesControlRowsInput; group?: v.InferInput<typeof SpeciesGroupSchema> | undefined; directed?: v.InferInput<typeof DirectedSpeciesSchema> | undefined; guard?: true | undefined; elite?: true | undefined; postPose?: { alive: string; dead?: string; envelopes?: v.InferInput<typeof RidingPresentationSchema>; } | undefined; material: { rim: number; bands: number; }; })[]; }, 'slug' | 'rows' | 'program'>; }
export interface SpeciesPresentationRows { poses: Record<string, { prefix: string; group: string; scalars: (unknown)[]; look?: unknown; alive?: boolean; }>; packedBodies: v.InferOutput<typeof CompactSpeciesBodiesSchema>; guest: CreatureGuestRows; lookBook: Pick<{ slug: string; body: unknown; poses?: Record<string, unknown> | undefined; program?: unknown; rows: ({ metadata: v.InferOutput<typeof SpeciesSchema>; id: string; family: string; rigContract: { skeleton: string; clips: (v.InferOutput<typeof SkinClipNameSchema>)[]; sockets: (string)[]; }; rig?: 'quadruped' | 'custom' | undefined; pose?: { grazeNeck: number; gallopTail: number; } | undefined; gait?: { trot: number; gallop: number; } | undefined; eyeGlow?: [number, number, number] | undefined; eyeGlowIntensity?: number | undefined; variants: Record<string, { body: string; tint?: Record<string, [number, number, number]> | undefined; traits?: Record<string, (number) | (boolean)> | undefined; }>; projection?: v.InferOutput<typeof ActorProjectionV2Schema>; control?: ArenaRoomSpeciesControlRows; group?: v.InferOutput<typeof SpeciesGroupSchema> | undefined; directed?: v.InferOutput<typeof DirectedSpeciesSchema> | undefined; guard?: true | undefined; elite?: true | undefined; postPose?: { alive: string; dead?: string; envelopes?: v.InferOutput<typeof RidingPresentationSchema>; } | undefined; material: { rim: number; bands: number; }; })[]; }, 'slug' | 'rows' | 'program'>; }
export interface SpeciesActorsFileRowsInput { species: SpeciesPresentationRowsInput; page: { world: unknown; specimen: unknown; }; draws: v.InferInput<typeof FixedDrawRowsSchema>; pivots: ([number, number, number])[]; parts: (string)[]; radius: number; }
export interface SpeciesActorsFileRows { species: SpeciesPresentationRows; page: { world: unknown; specimen: unknown; }; draws: v.InferOutput<typeof FixedDrawRowsSchema>; pivots: ([number, number, number])[]; parts: (string)[]; radius: number; }
