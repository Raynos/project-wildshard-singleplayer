import { BinaryFileSchema } from './binarySource';
import { SceneInstancesSchema } from './sceneInstances';
import * as v from 'valibot';
import { isJsonData } from './json';
import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, SpecimenAssetSchema, SpecimenModelMetadataSchema, SpecimenTextureSchema } from './specimenCatalogue';
import { AmbientFlockSchema, AmbientPerchesSchema } from './ambientLife';
import { PrivateSceneSchema } from './clientChannels';
import { EncounterSitesSchema } from './encounterRows';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1000000));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
export const SceneBakedGeometrySchema: v.GenericSchema<SceneBakedGeometryRowsInput, SceneBakedGeometryRows> = v.strictObject({ attrs: list(v.tuple([id, v.picklist(['f32','f16','u16','i8','u8']), count, v.boolean()]),32),count,index:v.nullable(v.picklist(['u16','u32'])),indexCount:count,box:v.boolean(),expand:v.boolean() });
const geometry = v.variant('kind',[
  v.strictObject({kind:v.literal('asset'),row:SpecimenAssetSchema}),
  v.strictObject({kind:v.literal('baked'),url:id,address:v.strictObject({file:id,word:count}),row:SceneBakedGeometrySchema}),
  v.strictObject({kind:v.literal('baked-file'),...BinaryFileSchema.entries,address:v.strictObject({file:id,word:count}),row:SceneBakedGeometrySchema,sphere:v.exactOptional(v.tuple([finite,finite,finite,finite]))}),
  v.strictObject({kind:v.literal('inline'),data:v.pipe(v.string(),v.maxLength(1048576)),row:SceneBakedGeometrySchema,sphere:v.exactOptional(v.tuple([finite,finite,finite,finite]))}),
  v.strictObject({kind:v.literal('file'),...BinaryFileSchema.entries,row:SceneBakedGeometrySchema,sphere:v.exactOptional(v.tuple([finite,finite,finite,finite]))}),
  v.strictObject({kind:v.literal('packed'),source:id,key:id}),
]);
export const SceneScatterPoseSchema: v.GenericSchema<SceneScatterPoseRowsInput, SceneScatterPoseRows> = v.strictObject({x:finite,y:finite,z:finite,yaw:finite,sx:finite,sy:finite,sz:finite,far:finite,r:finite,g:finite,b:finite,
  tiltX:v.exactOptional(finite),tiltZ:v.exactOptional(finite),solid:v.exactOptional(v.union([v.literal(true),v.literal(1)]))});
const finiteField = (row: object, key: string): number | undefined => {
  if (!Object.hasOwn(row, key)) return undefined;
  const value: unknown = Reflect.get(row, key);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid scene scatter pose ${key}`);
  return value;
};
/** One scatter pose by SceneScatterPoseSchema's rules in one pass: the same required finite fields, optional tilts and
 *  solid flag, no other key, and the same output (G782: the schema's per-row strict object was ~130 ms of a phone-4x
 *  Nalati dressing). */
export function readSceneScatterPose(input: unknown): SceneScatterPoseRows {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid scene scatter pose');
  let known = 0;
  const field = (key: string): number => { const value = finiteField(input, key); if (value === undefined) throw new Error(`Missing scene scatter pose ${key}`); known++; return value; };
  const pose: SceneScatterPoseRows = { x: field('x'), y: field('y'), z: field('z'), yaw: field('yaw'), sx: field('sx'), sy: field('sy'), sz: field('sz'),
    far: field('far'), r: field('r'), g: field('g'), b: field('b') };
  const tiltX = finiteField(input, 'tiltX'), tiltZ = finiteField(input, 'tiltZ');
  if (tiltX !== undefined) { pose.tiltX = tiltX; known++; }
  if (tiltZ !== undefined) { pose.tiltZ = tiltZ; known++; }
  if (Object.hasOwn(input, 'solid')) {
    const solid: unknown = Reflect.get(input, 'solid');
    if (solid !== true && solid !== 1) throw new Error('Invalid scene scatter pose solid');
    pose.solid = solid; known++;
  }
  if (Object.keys(input).length !== known) throw new Error('Unknown scene scatter pose key');
  return pose;
}
const surface=v.exactOptional(v.picklist(['sand','wetSand','grass','rock','planks','stone','water','wood','metal','flesh','shell','ground','edge','felt','earth']));
const point=v.strictObject({x:finite,y:finite,z:finite});
const base={x:finite,y:finite,z:finite,surface,yaw:v.exactOptional(finite),rot:v.exactOptional(v.strictObject({x:finite,y:finite,z:finite,w:finite}))};
export const SceneDressingContactsSchema: v.GenericSchema<SceneDressingContactsRowsInput, SceneDressingContactsRows> =list(v.variant('kind',[
  v.strictObject({kind:v.literal('hull'),...base,points:list(finite,24576)}),
  v.strictObject({kind:v.literal('box'),...base,hx:finite,hy:finite,hz:finite}),
  v.strictObject({kind:v.literal('capsule'),...base,halfHeight:finite,radius:finite}),
  v.strictObject({kind:v.literal('treads'),from:point,to:point,width:finite,count:v.pipe(finite,v.integer(),v.minValue(1)),surface}),
]),32768);
export const SceneFloorSchema: v.GenericSchema<SceneFloorRowsInput, SceneFloorRows> =v.union([
  v.strictObject({rects:list(v.strictObject({x:finite,z:finite,hw:finite,hd:finite,y:finite,rot:v.exactOptional(finite),slope:v.exactOptional(finite),tilt:v.exactOptional(finite),profile:v.exactOptional(list(v.tuple([finite,finite,finite]),8))}),4096)}),
  v.strictObject({x:finite,z:finite,size:v.pipe(finite,v.minValue(0)),res:v.pipe(count,v.minValue(2)),data:v.pipe(v.string(),v.maxLength(1048576))}),
  v.strictObject({x:finite,z:finite,size:v.pipe(finite,v.minValue(0)),res:v.pipe(count,v.minValue(2)),...BinaryFileSchema.entries}),
]);
const packedContacts={kind:v.literal('packed-hulls'),origins:list(v.tuple([finite,finite,finite,count]),8192),surface:v.picklist(['rock','wood','stone','ground'])};
const contactSource = v.union([SceneDressingContactsSchema,
  v.strictObject({...packedContacts,data:v.pipe(v.string(),v.maxLength(1048576))}),
  v.strictObject({...packedContacts,file:id}),
]);
const pose = v.strictObject({x:finite,y:finite,z:finite,variant:v.exactOptional(id),yaw:v.exactOptional(finite),heading:v.exactOptional(v.tuple([finite,finite])),matrix:v.exactOptional(v.pipe(v.array(finite),v.length(16)))});
/** Z2 client-only scatter/static/ambient projection; shader and model identities are declared data. */
const sceneDressing = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  name:id,
  instances:v.optional(SceneInstancesSchema,[]),
  staticModels:v.optional(list(v.strictObject({model:SpecimenModelMetadataSchema,geometry:id,material:id}),128),[]),
  catalogues:list(v.union([v.strictObject({rows:SpecimenCatalogueSchema,load:v.exactOptional(v.literal('after-control')),packed:v.exactOptional(PackedSpecimenSchema),materials:v.optional(v.record(id,SpecimenMaterialSchema),{})}),v.strictObject({rows:SpecimenCatalogueSchema,load:v.exactOptional(v.literal('after-control')),pack:id})]),8),
  packs:v.record(id,v.strictObject({rows:PackedSpecimenSchema,materials:v.record(id,SpecimenMaterialSchema)})),
  geometry:v.record(id,geometry),
  materials:v.record(id,v.variant('kind',[
    v.strictObject({kind:v.literal('specimen'),row:SpecimenMaterialSchema}),
    v.strictObject({kind:v.literal('asset'),row:SpecimenAssetSchema}),
    v.strictObject({kind:v.literal('painterly'),rim:finite,bands:finite,sway:v.exactOptional(finite),shade:v.exactOptional(finite),emissive:v.exactOptional(finite)}),
    v.strictObject({kind:v.literal('look'),look:id,params:v.exactOptional(v.record(id,v.union([finite,list(finite,16)]))),textures:v.exactOptional(v.record(id,SpecimenTextureSchema))}),
    v.strictObject({kind:v.literal('mapped'),look:id,over:id}),
    /** Painted lettering borrows raw RGBA8 from a file, or retains the legacy compressed inline atlas. */
    v.strictObject({kind:v.literal('lettering'),width:count,height:count,data:v.pipe(v.string(),v.maxLength(1048576)),rim:finite}),
    v.strictObject({kind:v.literal('lettering-file'),...BinaryFileSchema.entries,width:count,height:count,rim:finite}),
  ])),
  layers:list(v.strictObject({id,model:id,geometry:id,material:id,file:id,binary:v.boolean(),far:finite,castShadow:v.boolean(),keepNear:finite,
    select:v.exactOptional(v.strictObject({modulo:v.pipe(count,v.minValue(1)),remainder:count,equal:v.boolean()})),contacts:contactSource}),32),
  statics:list(v.strictObject({name:id,recipe:PrivateSceneSchema,geometry:v.record(id,id),materials:v.record(id,id),tris:finite,
    /** the place's named gameplay points (an entrance, ledges, a tie spot), read by the encounters it hosts */
    anchors:v.optional(v.record(id,list(v.strictObject({x:finite,y:finite,z:finite,r:v.optional(finite,0),facing:v.optional(finite,0)}),256)),{}),
    members:list(v.strictObject({model:id,draw:v.picklist(['single','instanced','merged']),placements:list(pose,8192),boxes:list(finite,49152),contacts:contactSource,floors:v.optional(list(SceneFloorSchema,64),[])}),128)}),32),
  wings:v.exactOptional(v.strictObject({groups:list(v.strictObject({kind:id,row:AmbientFlockSchema,perches:AmbientPerchesSchema}),32),
    layers:list(v.strictObject({id,capacity:count,palette:list(v.union([finite,id]),256),flap:v.nullable(v.tuple([finite,finite,finite])),geometry:id,material:id}),32)})),
  animations:list(v.strictObject({look:id,timeParam:id,windParam:id,windScale:finite,windMax:finite}),32),
  motes:v.exactOptional(v.strictObject({name:id,count,seed:count,look:id,drift:finite,driftParam:id,pixelParam:id})),
  /** encounter sites (game/boss/encounterView) drawing a declared model, solid while they stand */
  sites:v.optional(list(v.strictObject({name:id,model:id,rows:EncounterSitesSchema}),8),[]),
  /** instanced quads in a lent look, their per-instance attributes baked; the look hears the painted wind (clamped), shade and sun */
  emitters:v.optional(list(v.strictObject({name:id,look:id,renderOrder:count,centre:v.tuple([finite,finite,finite]),radius:finite,
    attributes:v.record(id,v.strictObject({width:v.pipe(count,v.minValue(1),v.maxValue(4)),values:list(finite,1048576)})),
    params:v.strictObject({wind:id,windClamp:finite,shade:id,sun:id})}),8),[]),
}),v.check(rows=>{
  const models=new Set(rows.catalogues.flatMap(source=>source.rows.map(row=>row.model.id)).concat(rows.staticModels.map(row=>row.model.id)));
  const shape=(key:string)=>Object.hasOwn(rows.geometry,key),paint=(key:string)=>Object.hasOwn(rows.materials,key);
  return new Set(rows.statics.map(row=>row.name)).size===rows.statics.length
    && rows.catalogues.every(source=>!('pack'in source)||Object.hasOwn(rows.packs,source.pack))
    && rows.staticModels.every(row=>shape(row.geometry)&&paint(row.material))
    && rows.instances.every(row=>shape(row.geometry)&&paint(row.material)&&rows.statics.some(group=>group.name===row.group))
    && rows.sites.every(row=>models.has(row.model))
    && rows.layers.every(row=>models.has(row.model)&&shape(row.geometry)&&paint(row.material)&&(row.select===undefined||row.select.remainder<row.select.modulo))
    && rows.statics.every(row=>Object.values(row.geometry).every(shape)&&Object.values(row.materials).every(paint)&&row.members.every(member=>models.has(member.model)&&member.boxes.length===member.placements.length*6))
    && Object.values(rows.materials).every(row=>row.kind!=='mapped'||paint(row.over)&&rows.materials[row.over]?.kind!=='mapped')
    && Object.values(rows.geometry).every(row=>row.kind!=='packed'||Object.hasOwn(rows.packs,row.source))
    && (rows.wings===undefined||rows.wings.layers.every(row=>shape(row.geometry)&&paint(row.material)));
},'Dressing references require declared shapes, materials, models and complete copy bounds'));
export interface SceneDressingRows { name: string; instances: v.InferOutput<typeof SceneInstancesSchema>;
  staticModels: ({ model: v.InferOutput<typeof SpecimenModelMetadataSchema>; geometry: string; material: string;
  })[]; catalogues: (({ rows: v.InferOutput<typeof SpecimenCatalogueSchema>; load?: 'after-control'; packed?: v.InferOutput<typeof
  PackedSpecimenSchema>; materials: Record<string, v.InferOutput<typeof SpecimenMaterialSchema>>; }) | ({ rows:
  v.InferOutput<typeof SpecimenCatalogueSchema>; load?: 'after-control'; pack: string; }))[]; packs: Record<string, { rows:
  v.InferOutput<typeof PackedSpecimenSchema>; materials: Record<string, v.InferOutput<typeof
  SpecimenMaterialSchema>>; }>; geometry: Record<string, ({ kind: 'asset'; row: v.InferOutput<typeof
  SpecimenAssetSchema>; }) | ({ kind: 'baked'; url: string; address: { file: string; word: number; }; row:
  SceneBakedGeometryRows; }) | ({ kind: 'baked-file'; address: { file: string; word: number; }; row:
  SceneBakedGeometryRows; sphere?: [number, number, number, number]; } & v.InferOutput<typeof BinaryFileSchema>) | ({ kind: 'inline'; data: string; row:
  SceneBakedGeometryRows; sphere?: [number, number, number, number]; }) | ({ kind: 'file'; row:
  SceneBakedGeometryRows; sphere?: [number, number, number, number]; } & v.InferOutput<typeof BinaryFileSchema>)
  | ({ kind: 'packed'; source: string; key: string; })>; materials: Record<string, ({ kind: 'specimen'; row:
  v.InferOutput<typeof SpecimenMaterialSchema>; }) | ({ kind: 'asset'; row: v.InferOutput<typeof
  SpecimenAssetSchema>; }) | ({ kind: 'painterly'; rim: number; bands: number; sway?: number; shade?: number;
  emissive?: number; }) | ({ kind: 'look'; look: string; params?: Record<string, (number) | ((number)[])>;
  textures?: Record<string, v.InferOutput<typeof SpecimenTextureSchema>>; }) | ({ kind: 'mapped'; look: string;
  over: string; }) | ({ kind: 'lettering'; width: number; height: number; data: string; rim: number; }) | ({
  kind: 'lettering-file'; width: number; height: number; rim: number; } & v.InferOutput<typeof
  BinaryFileSchema>)>; layers: ({ id: string; model: string; geometry: string; material: string; file: string;
  binary: boolean; far: number; castShadow: boolean; keepNear: number; select?: { modulo: number; remainder:
  number; equal: boolean; }; contacts: (SceneDressingContactsRows) | ({ data: string; } & { kind:
  'packed-hulls'; origins: ([number, number, number, number])[]; surface: 'rock' | 'wood' | 'stone' | 'ground';
  }) | ({ file: string; } & { kind: 'packed-hulls'; origins: ([number, number, number, number])[]; surface:
  'rock' | 'wood' | 'stone' | 'ground'; }); })[]; statics: ({ name: string; recipe: v.InferOutput<typeof
  PrivateSceneSchema>; geometry: Record<string, string>; materials: Record<string, string>; tris: number;
  anchors: Record<string, ({ x: number; y: number; z: number; r: number; facing: number; })[]>; members: ({
  model: string; draw: 'single' | 'instanced' | 'merged'; placements: ({ x: number; y: number; z: number;
  variant?: string; yaw?: number; heading?: [number, number]; matrix?: (number)[]; })[]; boxes: (number)[];
  contacts: (SceneDressingContactsRows) | ({ data: string; } & { kind: 'packed-hulls'; origins: ([number,
  number, number, number])[]; surface: 'rock' | 'wood' | 'stone' | 'ground'; }) | ({ file: string; } & { kind:
  'packed-hulls'; origins: ([number, number, number, number])[]; surface: 'rock' | 'wood' | 'stone' | 'ground';
  }); floors: (SceneFloorRows)[]; })[]; })[]; wings?: { groups: ({ kind: string; row: v.InferOutput<typeof
  AmbientFlockSchema>; perches: v.InferOutput<typeof AmbientPerchesSchema>; })[]; layers: ({ id: string;
  capacity: number; palette: ((number) | (string))[]; flap: ([number, number, number]) | null; geometry: string;
  material: string; })[]; }; animations: ({ look: string; timeParam: string; windParam: string; windScale:
  number; windMax: number; })[]; motes?: { name: string; count: number; seed: number; look: string; drift:
  number; driftParam: string; pixelParam: string; }; sites: ({ name: string; model: string; rows:
  v.InferOutput<typeof EncounterSitesSchema>; })[]; emitters: ({ name: string; look: string; renderOrder:
  number; centre: [number, number, number]; radius: number; attributes: Record<string, { width: number; values:
  (number)[]; }>; params: { wind: string; windClamp: number; shade: string; sun: string; }; })[]; }
export const SceneDressingSchema:v.GenericSchema<unknown,SceneDressingRows>=sceneDressing;

/** Bounded validated dressing data, independent of schema implementation metadata. */
export interface SceneBakedGeometryRowsInput { attrs: ([string, 'f32' | 'f16' | 'u16' | 'i8' | 'u8', number,
  boolean])[]; count: number; index: ('u16' | 'u32') | null; indexCount: number; box: boolean; expand: boolean;
  }
export interface SceneBakedGeometryRows { attrs: ([string, 'f32' | 'f16' | 'u16' | 'i8' | 'u8', number,
  boolean])[]; count: number; index: ('u16' | 'u32') | null; indexCount: number; box: boolean; expand: boolean;
  }
export interface SceneScatterPoseRowsInput { x: number; y: number; z: number; yaw: number; sx: number; sy: number;
  sz: number; far: number; r: number; g: number; b: number; tiltX?: number; tiltZ?: number; solid?: (true) |
  (1); }
export interface SceneScatterPoseRows { x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz:
  number; far: number; r: number; g: number; b: number; tiltX?: number; tiltZ?: number; solid?: (true) | (1); }
export type SceneDressingContactsRowsInput = (({ kind: 'hull'; points: (number)[]; } & { x: number; y: number;
  z: number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'box'; hx: number; hy: number; hz: number; } & { x: number; y: number; z:
  number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'capsule'; halfHeight: number; radius: number; } & { x: number; y: number;
  z: number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'treads'; from: { x: number; y: number; z: number; }; to: { x: number; y:
  number; z: number; }; width: number; count: number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks'
  | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; }))[];
export type SceneDressingContactsRows = (({ kind: 'hull'; points: (number)[]; } & { x: number; y: number; z:
  number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'box'; hx: number; hy: number; hz: number; } & { x: number; y: number; z:
  number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'capsule'; halfHeight: number; radius: number; } & { x: number; y: number;
  z: number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' |
  'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; yaw?: number; rot?: { x: number; y: number; z:
  number; w: number; }; }) | ({ kind: 'treads'; from: { x: number; y: number; z: number; }; to: { x: number; y:
  number; z: number; }; width: number; count: number; surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks'
  | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth'; }))[];
export type SceneFloorRowsInput = ({ rects: ({ x: number; z: number; hw: number; hd: number; y: number; rot?:
  number; slope?: number; tilt?: number; profile?: ([number, number, number])[]; })[]; }) | ({ x: number; z:
  number; size: number; res: number; data: string; }) | ({ x: number; z: number; size: number; res: number; } &
  v.InferInput<typeof BinaryFileSchema>);
export type SceneFloorRows = ({ rects: ({ x: number; z: number; hw: number; hd: number; y: number; rot?: number;
  slope?: number; tilt?: number; profile?: ([number, number, number])[]; })[]; }) | ({ x: number; z: number;
  size: number; res: number; data: string; }) | ({ x: number; z: number; size: number; res: number; } &
  v.InferOutput<typeof BinaryFileSchema>);
