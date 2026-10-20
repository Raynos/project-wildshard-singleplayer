import { SceneInstancesSchema } from './sceneInstances';
import * as v from 'valibot';
import { isJsonData } from './json';
import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, SpecimenAssetSchema, SpecimenModelMetadataSchema, SpecimenTextureSchema } from './specimenCatalogue';
import { AmbientFlockSchema, AmbientPerchesSchema } from './ambientLife';
import { PrivateSceneSchema } from './clientChannels';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1000000));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
export const SceneBakedGeometrySchema = v.strictObject({ attrs: list(v.tuple([id, v.picklist(['f32','f16','u16','i8','u8']), count, v.boolean()]),32),count,index:v.nullable(v.picklist(['u16','u32'])),indexCount:count,box:v.boolean(),expand:v.boolean() });
const geometry = v.variant('kind',[
  v.strictObject({kind:v.literal('asset'),row:SpecimenAssetSchema}),
  v.strictObject({kind:v.literal('baked'),url:id,address:v.strictObject({file:id,word:count}),row:SceneBakedGeometrySchema}),
  v.strictObject({kind:v.literal('inline'),data:v.pipe(v.string(),v.maxLength(1048576)),row:SceneBakedGeometrySchema,sphere:v.exactOptional(v.tuple([finite,finite,finite,finite]))}),
  v.strictObject({kind:v.literal('packed'),source:id,key:id}),
]);
export const SceneScatterPoseSchema = v.strictObject({x:finite,y:finite,z:finite,yaw:finite,sx:finite,sy:finite,sz:finite,far:finite,r:finite,g:finite,b:finite,
  tiltX:v.exactOptional(finite),tiltZ:v.exactOptional(finite),solid:v.exactOptional(v.union([v.literal(true),v.literal(1)]))});
const surface=v.exactOptional(v.picklist(['sand','wetSand','grass','rock','planks','stone','water','wood','metal','flesh','shell','ground','edge','felt','earth']));
const point=v.strictObject({x:finite,y:finite,z:finite});
const base={x:finite,y:finite,z:finite,surface,yaw:v.exactOptional(finite),rot:v.exactOptional(v.strictObject({x:finite,y:finite,z:finite,w:finite}))};
export const SceneDressingContactsSchema=list(v.variant('kind',[
  v.strictObject({kind:v.literal('hull'),...base,points:list(finite,24576)}),
  v.strictObject({kind:v.literal('box'),...base,hx:finite,hy:finite,hz:finite}),
  v.strictObject({kind:v.literal('capsule'),...base,halfHeight:finite,radius:finite}),
  v.strictObject({kind:v.literal('treads'),from:point,to:point,width:finite,count:v.pipe(finite,v.integer(),v.minValue(1)),surface}),
]),32768);
export const SceneFloorSchema=v.union([
  v.strictObject({rects:list(v.strictObject({x:finite,z:finite,hw:finite,hd:finite,y:finite,rot:v.exactOptional(finite),slope:v.exactOptional(finite),tilt:v.exactOptional(finite),profile:v.exactOptional(list(v.tuple([finite,finite,finite]),8))}),4096)}),
  v.strictObject({x:finite,z:finite,size:v.pipe(finite,v.minValue(0)),res:v.pipe(count,v.minValue(2)),data:v.pipe(v.string(),v.maxLength(1048576))}),
]);
const contactSource = v.union([SceneDressingContactsSchema,v.strictObject({kind:v.literal('packed-hulls'),data:v.pipe(v.string(),v.maxLength(1048576)),origins:list(v.tuple([finite,finite,finite,count]),8192),surface:v.picklist(['rock','wood','stone','ground'])})]);
const pose = v.strictObject({x:finite,y:finite,z:finite,variant:v.exactOptional(id),yaw:v.exactOptional(finite),heading:v.exactOptional(v.tuple([finite,finite])),matrix:v.exactOptional(v.pipe(v.array(finite),v.length(16)))});
/** Z2 client-only scatter/static/ambient projection; shader and model identities are declared data. */
const sceneDressing = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  name:id,
  instances:v.optional(SceneInstancesSchema,[]),
  staticModels:v.optional(list(v.strictObject({model:SpecimenModelMetadataSchema,geometry:id,material:id}),128),[]),
  catalogues:list(v.union([v.strictObject({rows:SpecimenCatalogueSchema,packed:PackedSpecimenSchema,materials:v.record(id,SpecimenMaterialSchema)}),v.strictObject({rows:SpecimenCatalogueSchema,pack:id})]),8),
  packs:v.record(id,v.strictObject({rows:PackedSpecimenSchema,materials:v.record(id,SpecimenMaterialSchema)})),
  geometry:v.record(id,geometry),
  materials:v.record(id,v.variant('kind',[
    v.strictObject({kind:v.literal('specimen'),row:SpecimenMaterialSchema}),
    v.strictObject({kind:v.literal('asset'),row:SpecimenAssetSchema}),
    v.strictObject({kind:v.literal('painterly'),rim:finite,bands:finite,sway:v.exactOptional(finite),shade:v.exactOptional(finite),emissive:v.exactOptional(finite)}),
    v.strictObject({kind:v.literal('look'),look:id,params:v.exactOptional(v.record(id,v.union([finite,list(finite,16)]))),textures:v.exactOptional(v.record(id,SpecimenTextureSchema))}),
    v.strictObject({kind:v.literal('mapped'),look:id,over:id}),
  ])),
  layers:list(v.strictObject({id,model:id,geometry:id,material:id,file:id,binary:v.boolean(),far:finite,castShadow:v.boolean(),keepNear:finite,
    select:v.exactOptional(v.strictObject({modulo:v.pipe(count,v.minValue(1)),remainder:count,equal:v.boolean()})),contacts:contactSource}),32),
  statics:list(v.strictObject({name:id,recipe:PrivateSceneSchema,geometry:v.record(id,id),materials:v.record(id,id),tris:finite,
    members:list(v.strictObject({model:id,draw:v.picklist(['single','instanced','merged']),placements:list(pose,8192),boxes:list(finite,49152),contacts:contactSource,floors:v.optional(list(SceneFloorSchema,64),[])}),128)}),32),
  wings:v.exactOptional(v.strictObject({groups:list(v.strictObject({kind:id,row:AmbientFlockSchema,perches:AmbientPerchesSchema}),32),
    layers:list(v.strictObject({id,capacity:count,palette:list(v.union([finite,id]),256),flap:v.nullable(v.tuple([finite,finite,finite])),geometry:id,material:id}),32)})),
  animations:list(v.strictObject({look:id,timeParam:id,windParam:id,windScale:finite,windMax:finite}),32),
  motes:v.exactOptional(v.strictObject({name:id,count,seed:count,look:id,drift:finite,driftParam:id,pixelParam:id})),
}),v.check(rows=>{
  const models=new Set(rows.catalogues.flatMap(source=>source.rows.map(row=>row.model.id)).concat(rows.staticModels.map(row=>row.model.id)));
  const shape=(key:string)=>Object.hasOwn(rows.geometry,key),paint=(key:string)=>Object.hasOwn(rows.materials,key);
  return new Set(rows.statics.map(row=>row.name)).size===rows.statics.length
    && rows.catalogues.every(source=>!('pack'in source)||Object.hasOwn(rows.packs,source.pack))
    && rows.staticModels.every(row=>shape(row.geometry)&&paint(row.material))
    && rows.instances.every(row=>shape(row.geometry)&&paint(row.material)&&rows.statics.some(group=>group.name===row.group))
    && rows.layers.every(row=>models.has(row.model)&&shape(row.geometry)&&paint(row.material)&&(row.select===undefined||row.select.remainder<row.select.modulo))
    && rows.statics.every(row=>Object.values(row.geometry).every(shape)&&Object.values(row.materials).every(paint)&&row.members.every(member=>models.has(member.model)&&member.boxes.length===member.placements.length*6))
    && Object.values(rows.materials).every(row=>row.kind!=='mapped'||paint(row.over)&&rows.materials[row.over]?.kind!=='mapped')
    && Object.values(rows.geometry).every(row=>row.kind!=='packed'||Object.hasOwn(rows.packs,row.source))
    && (rows.wings===undefined||rows.wings.layers.every(row=>shape(row.geometry)&&paint(row.material)));
},'Dressing references require declared shapes, materials, models and complete copy bounds'));
export type SceneDressingRows = v.InferOutput<typeof sceneDressing>;
export const SceneDressingSchema:v.GenericSchema<unknown,SceneDressingRows>=sceneDressing;
