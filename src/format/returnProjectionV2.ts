/** Stateless numeric projections use the existing ABI-v2 frame, field, command
 * and borrowed-RNG banks. A declaration grants names, never native owners. */
import * as v from 'valibot';
import { isJsonData } from './json';
import { ScriptArtifactV2Schema } from './scriptAdmissionV2';
import { layoutV2, type V2Layout } from './scriptWireV2';

const names = v.pipe(v.array(v.pipe(v.string(),v.minLength(1),v.maxLength(512),v.check(name => !['__proto__','prototype','constructor'].includes(name)))),v.minLength(1),v.maxLength(256));
export const ReturnProjectionV2Schema = v.strictObject({ artifact: ScriptArtifactV2Schema,
  fields: names,signals: names,channels: names,bytes: v.pipe(v.string(),v.maxLength(2_000_000)) });
export type ReturnProjectionV2Rows = v.InferOutput<typeof ReturnProjectionV2Schema>;
/** Nine detached field frames retain actor zero plus the original eight ordered
 * candidates. Missing fields remain absent and refuse only if actually read. */
export function returnProjectionV2Layout(fields: number,pages = 1): V2Layout {
  if (!Number.isInteger(fields) || fields < 1 || fields > 256) throw new Error('Invalid projection field count');
  return layoutV2(0,pages,new Map([[1,1],[4,1],[5,1],[6,fields*9],[10,32],[21,1],[22,1]]));
}
export function parseReturnProjectionV2(input: unknown): ReturnProjectionV2Rows {
  if (!isJsonData(input)) throw new Error('Return projection requires JSON data');
  const row = v.parse(ReturnProjectionV2Schema,input);
  if (row.artifact.lane !== 'project' || row.artifact.ioBytes !== returnProjectionV2Layout(row.fields.length,row.artifact.pages).bytes
    || [row.fields,row.signals,row.channels].some(list => new Set(list).size !== list.length || list.some((name,i) => i > 0 && (list[i-1] ?? '') >= name))) throw new Error('Invalid projection declaration');
  return row;
}
