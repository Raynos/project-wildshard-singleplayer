/** Stateless numeric projections use the existing ABI-v2 frame, field, command
 * and borrowed-RNG banks. A declaration grants names, never native owners. */
import * as v from 'valibot';
import { isJsonData } from './json';
import { ScriptArtifactV2Schema } from './scriptAdmissionV2';
import { GroupStepV2Schema, parseGroupStepV2, groupStepLayoutV2, type GroupStepRowsV2 } from './scriptGroupStepV2';
import { layoutV2, type V2Layout } from './scriptWireV2';

const bindingName=v.pipe(v.string(),v.minLength(1),v.maxLength(512),v.regex(/^(?!__proto__$|prototype$|constructor$)/));
const additionalNames=v.pipe(v.array(bindingName),v.maxLength(256));
const names=v.pipe(v.array(bindingName),v.minLength(1),v.maxLength(256));
export const ReturnProjectionV2Schema = v.strictObject({ artifact: v.strictObject({...ScriptArtifactV2Schema.entries,lane:v.literal('project')}),
  fields: names,signals: names,channels: names,additional:v.exactOptional(v.strictObject({fields:additionalNames,signals:additionalNames,channels:additionalNames})),outputCapacity:v.exactOptional(v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(128))),bytes: v.pipe(v.string(),v.maxLength(2_000_000)),groups: v.exactOptional(GroupStepV2Schema) });
export type ReturnProjectionV2Rows = v.InferOutput<typeof ReturnProjectionV2Schema>;
/** Nine detached field frames retain actor zero plus the original eight ordered
 * candidates. Missing fields remain absent and refuse only if actually read. */
export function returnProjectionV2Layout(fields: number,pages = 1,outputCapacity = 32,groups?:GroupStepRowsV2): V2Layout {
  if (!Number.isInteger(fields) || fields < 1 || fields > 256) throw new Error('Invalid projection field count');
  if (!Number.isInteger(outputCapacity) || outputCapacity < 1 || outputCapacity > 128) throw new Error('Invalid projection output capacity');
  if(groups!==undefined&&groups.pages!==pages)throw new Error('Shared projection pages differ');
  const capacities=new Map(groups===undefined?[]:groupStepLayoutV2(groups).regions.map(row=>[row.kind,row.capacity]));
  for(const [kind,capacity]of [[1,1],[4,1],[5,1],[6,fields*9],[10,outputCapacity],[21,1],[22,1]] as const)
    capacities.set(kind,Math.max(capacities.get(kind)??0,capacity));
  return layoutV2(0,pages,capacities);
}
export function parseReturnProjectionV2(input: unknown): ReturnProjectionV2Rows {
  if (!isJsonData(input)) throw new Error('Return projection requires JSON data');
  const row = v.parse(ReturnProjectionV2Schema,input);
  if(row.groups!==undefined)parseGroupStepV2(row.groups);
  if (row.artifact.ioBytes !== returnProjectionV2Layout(row.fields.length,row.artifact.pages,row.outputCapacity,row.groups).bytes
    || [row.fields,row.signals,row.channels].some(list => new Set(list).size !== list.length || list.some((name,i) => i > 0 && (list[i-1] ?? '') >= name))) throw new Error('Invalid projection declaration');
  for(const kind of ['fields','signals','channels'] as const){
    const extra=row.additional?.[kind]??[],declared=row[kind],base=declared.slice(0,declared.length-extra.length);
    if(extra.some((name,index)=>!declared.includes(name)||index>0&&(extra[index-1]??'')>=name)
      ||JSON.stringify(declared.slice(base.length))!==JSON.stringify(extra))throw new Error('Invalid additional projection names');
  }
  return row;
}
