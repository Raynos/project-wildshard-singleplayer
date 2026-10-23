import * as v from 'valibot';
import { parseDecisionScripts } from './decisionScripts';
import { isJsonData } from './json';
import { ObservationColumnsV2Schema } from './scriptObservationColumnsV2';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';

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
v.strictObject({kind:v.literal('memory'),key,value:scalar}),
v.strictObject({kind:v.literal('position'),axis:v.picklist(['x','y','z']),value:scalar}),
v.strictObject({kind:v.literal('look'),weight:scalar}),
v.strictObject({kind:v.literal('state'),value:scalar,states:v.pipe(v.array(key),v.maxLength(64))}),
v.strictObject({kind:v.literal('attack'),when:condition,seconds:v.pipe(finite,v.minValue(0))}),
v.strictObject({kind:v.literal('motion'),when:condition,yaw:scalar,speed:scalar,turn:scalar,path:v.exactOptional(condition)}),
v.strictObject({kind:v.literal('cancel'),when:condition}),
v.strictObject({kind:v.literal('contact'),when:condition,strike:CreatureStrikeSchema,damage:scalar,
  length:v.exactOptional(v.strictTuple([finite,v.pipe(finite,v.minValue(.000001)),finite])),sound:v.exactOptional(key)}),
v.strictObject({kind:v.literal('sound'),value:scalar,sounds:v.pipe(v.array(v.string()),v.maxLength(64))}),
]);
const requestSchema = v.strictObject({signal:key,columns:ObservationColumnsV2Schema});
/** H4 finite actor projection. Rows select native columns and ordered operations;
* the AS projection owns policy. Continuation remains in the lent actor/group. */
export const ActorProjectionV2Schema = v.strictObject({
  program:ReturnProgramSchema,
  step:v.exactOptional(v.strictObject({signal:key,clock:key,every:v.pipe(finite,v.minValue(0)),
    columns:ObservationColumnsV2Schema,operations:v.pipe(v.array(operationSchema),v.maxLength(128))})),
  damage:v.exactOptional(v.strictObject({requests:v.pipe(v.array(requestSchema),v.minLength(1),v.maxLength(8)),result:key})),
});
export type ActorProjectionV2Rows = v.InferOutput<typeof ActorProjectionV2Schema>;
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
