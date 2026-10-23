import * as v from 'valibot';
import { parseDecisionScripts } from './decisionScripts';
import { isJsonData } from './json';
import { ObservationColumnsV2Schema,type ObservationColumnV2 } from './scriptObservationColumnsV2';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';


/** Named output boundaries keep nested Valibot schema inference out of every
 * species, product and JSON-schema caller. Runtime grammar is unchanged. */
type ProjectionScalarV2 = { kind: 'channel'; name: string } | { kind: 'constant'; value: number }
  | { kind: 'time' } | { kind: 'player'; axis: 'x' | 'y' | 'z' };
interface ProjectionConditionV2 { channel: string; equal: number }
type ProjectionOperationV2 =
  | { kind: 'memory'; key: string; value: ProjectionScalarV2; optional?: boolean }
  | { kind: 'position'; axis: 'x' | 'y' | 'z'; value: ProjectionScalarV2 }
  | { kind: 'look'; weight: ProjectionScalarV2 }
  | { kind: 'look-position'; x: ProjectionScalarV2; y: ProjectionScalarV2; z: ProjectionScalarV2; weight: ProjectionScalarV2 }
  | { kind: 'navigate'; x: ProjectionScalarV2; z: ProjectionScalarV2; yaw: ProjectionScalarV2; speed: ProjectionScalarV2; turn: ProjectionScalarV2; path: ProjectionScalarV2 }
  | { kind: 'confine' }
  | { kind: 'sound-position'; value: ProjectionScalarV2; cue: string; height: number }
  | { kind: 'state'; value: ProjectionScalarV2; states: string[]; required?: boolean }
  | { kind: 'attack'; when: ProjectionConditionV2; seconds: number }
  | { kind: 'motion'; when: ProjectionConditionV2; yaw: ProjectionScalarV2;
      speed: ProjectionScalarV2; turn: ProjectionScalarV2; path?: ProjectionConditionV2 }
  | { kind: 'cancel'; when: ProjectionConditionV2 }
  | { kind: 'contact'; when: ProjectionConditionV2; strike: v.InferOutput<typeof CreatureStrikeSchema>;
      damage: ProjectionScalarV2; length?: [number, number, number]; sound?: string }
  | { kind: 'sound'; value: ProjectionScalarV2; sounds: string[] };
interface ProjectionRequestV2 { signal: string; columns: ObservationColumnV2[] }
export interface ActorProjectionStepV2Rows extends ProjectionRequestV2 {
  clock: string; every: number; dt?: 'context'; operations: ProjectionOperationV2[];
}
export interface ActorProjectionV2Rows {
  program: v.InferOutput<typeof ReturnProgramSchema>;
  step?: ActorProjectionStepV2Rows;
  damage?: { requests: ProjectionRequestV2[]; result: string };
}

const key = v.pipe(v.string(),v.minLength(1),v.maxLength(128),v.regex(/^(?!(?:__proto__|prototype|constructor)$).+$/));
const finite = v.pipe(v.number(),v.finite());
const scalar = v.variant('kind',[
v.strictObject({kind:v.literal('channel'),name:key}),
v.strictObject({kind:v.literal('constant'),value:finite}),
v.strictObject({kind:v.literal('time')}),
v.strictObject({kind:v.literal('player'),axis:v.picklist(['x','y','z'])}),
]);
const condition = v.strictObject({channel:key,equal:finite});
const operationSchema = v.variant('kind',[
v.strictObject({kind:v.literal('memory'),key,value:scalar,optional:v.exactOptional(v.boolean())}),
v.strictObject({kind:v.literal('position'),axis:v.picklist(['x','y','z']),value:scalar}),
v.strictObject({kind:v.literal('look'),weight:scalar}),
v.strictObject({kind:v.literal('look-position'),x:scalar,y:scalar,z:scalar,weight:scalar}),
v.strictObject({kind:v.literal('navigate'),x:scalar,z:scalar,yaw:scalar,speed:scalar,turn:scalar,path:scalar}),
v.strictObject({kind:v.literal('confine')}),
v.strictObject({kind:v.literal('sound-position'),value:scalar,cue:key,height:finite}),
v.strictObject({kind:v.literal('state'),value:scalar,states:v.pipe(v.array(key),v.maxLength(64)),required:v.exactOptional(v.boolean())}),
v.strictObject({kind:v.literal('attack'),when:condition,seconds:v.pipe(finite,v.minValue(0))}),
v.strictObject({kind:v.literal('motion'),when:condition,yaw:scalar,speed:scalar,turn:scalar,path:v.exactOptional(condition)}),
v.strictObject({kind:v.literal('cancel'),when:condition}),
v.strictObject({kind:v.literal('contact'),when:condition,strike:CreatureStrikeSchema,damage:scalar,
  length:v.exactOptional(v.strictTuple([finite,v.pipe(finite,v.minValue(.000001)),finite])),sound:v.exactOptional(key)}),
v.strictObject({kind:v.literal('sound'),value:scalar,sounds:v.pipe(v.array(v.string()),v.maxLength(64))}),
]);
const requestSchema = v.strictObject({signal:key,columns:ObservationColumnsV2Schema});
export const ActorProjectionStepV2Schema:v.GenericSchema<ActorProjectionStepV2Rows>=v.strictObject({
  signal:key,clock:key,every:v.pipe(finite,v.minValue(0)),dt:v.exactOptional(v.literal('context')),
  columns:ObservationColumnsV2Schema,operations:v.pipe(v.array(operationSchema),v.maxLength(128)),
});
/** H4 finite actor projection. Rows select native columns and ordered operations;
* the AS projection owns policy. Continuation remains in the lent actor/group. */
export const ActorProjectionV2Schema: v.GenericSchema<ActorProjectionV2Rows> = v.strictObject({
  program:ReturnProgramSchema,
  step:v.exactOptional(ActorProjectionStepV2Schema),
  damage:v.exactOptional(v.strictObject({requests:v.pipe(v.array(requestSchema),v.minLength(1),v.maxLength(8)),result:key})),
});
export function parseActorProjectionV2(input:unknown):ActorProjectionV2Rows {
  if(!isJsonData(input))throw new Error('Actor projection requires JSON rows');
  const rows=v.parse(ActorProjectionV2Schema,input);
  if(rows.program.v2===undefined)throw new Error('Actor projection requires ABI2');
  const script=parseDecisionScripts([rows.program.script])[0];
  if(script===undefined)throw new Error('Missing actor projection program');
  const fields=Object.values(script.fields),channels=Object.values(script.channels),signals=Object.values(script.signals);
  for(const request of [...(rows.step===undefined?[]:[rows.step]),...(rows.damage?.requests??[])]){
    if(!signals.includes(request.signal)||request.columns.some(column=>!fields.includes(column.name)))throw new Error('Undeclared actor projection input');
  }
  for(const operation of rows.step?.operations??[]){
    if('when' in operation&&!channels.includes(operation.when.channel))throw new Error('Undeclared actor projection condition');
    const values:unknown[]=Object.values(operation);
    for(const value of values)if(typeof value==='object'&&value!==null&&'kind' in value&&value.kind==='channel'&&'name' in value&&!channels.includes(String(value.name)))throw new Error('Undeclared actor projection output');
  }
  return rows;
}
