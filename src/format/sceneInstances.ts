import * as v from 'valibot';
import { ClientChannelProgramSchema, ClientChannelPropertySchema } from './clientChannels';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(256));
const finite=v.pipe(v.number(),v.finite());
const slot=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(31));
const list=<T extends v.BaseSchema<unknown,unknown,v.BaseIssue<unknown>>>(schema:T,max:number)=>v.pipe(v.array(schema),v.maxLength(max));
const uint=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(0xffffffff));
const input=v.variant('kind',[
  v.strictObject({kind:v.literal('state'),slot}),v.strictObject({kind:v.literal('constant'),value:finite}),
  v.strictObject({kind:v.literal('frame'),property:ClientChannelPropertySchema}),v.strictObject({kind:v.literal('random')}),v.strictObject({kind:v.literal('blocked')}),
]);
/** Z2 client-only instanced pose projection. No actor, player, physics or authoritative state is writable. */
const sceneInstances=list(v.strictObject({
  id,group:id,geometry:id,material:id,step:v.pipe(finite,v.minValue(0)),initialCredit:finite,clock:v.picklist(['elapsed','world']),
  random:v.exactOptional(v.strictObject({id,state:v.strictObject({version:v.literal(1),state:uint,initial:uint,scrambledFork:v.boolean()})})),
  states:list(list(finite,32),8192),pose:v.strictObject({x:slot,z:slot,y:v.exactOptional(slot),yaw:v.exactOptional(slot),pitch:v.exactOptional(slot),roll:v.exactOptional(slot),scale:v.exactOptional(slot),colour:v.exactOptional(slot)}),
  programs:list(v.strictObject({row:ClientChannelProgramSchema,inputs:list(input,128),outputs:list(v.strictObject({property:ClientChannelPropertySchema,slot}),32)}),8),
  blocked:list(v.strictObject({x:finite,z:finite,r:v.pipe(finite,v.minValue(0))}),128),
  ground:finite,near:v.pipe(finite,v.minValue(0)),far:v.nullable(v.pipe(finite,v.minValue(0))),
  bounds:v.tuple([finite,finite,finite,v.pipe(finite,v.minValue(0))]),groundBounds:v.boolean(),castShadow:v.boolean(),receiveShadow:v.boolean(),
  palette:list(v.tuple([finite,finite,finite]),256),attributes:list(v.strictObject({name:id,width:v.picklist([1,2,3,4]),values:list(finite,32768)}),32),
  uniform:v.exactOptional(v.strictObject({look:id,param:id})),
}),32);
export type SceneInstancesRows=v.InferOutput<typeof sceneInstances>;
export const SceneInstancesSchema:v.GenericSchema<unknown,SceneInstancesRows>=sceneInstances;
