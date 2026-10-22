/** Strict stable-id continuation for ABI-v2 queries. Array limits come from
 * admitted fixed-memory capacities; this never executes or replays a query. */
import * as v from 'valibot';
import type { V2QueryRequest,V2QueryAnswer } from './scriptQueriesV2';

export interface V2QuerySnapshot {
  readonly phase: number;
  readonly highWater: readonly { readonly binding: string; readonly id: number }[];
  readonly entries: readonly { readonly request: V2QueryRequest; readonly reply: null | { readonly atTick: number; readonly answer: V2QueryAnswer } }[];
}

function schemas(scalars: number) {
  const number = v.pipe(v.number(),v.finite()), natural = v.pipe(number,v.integer(),v.minValue(0),v.maxValue(Number.MAX_SAFE_INTEGER));
  const id = v.pipe(v.string(),v.minLength(1)), point = v.strictTuple([number,number,number]);
  const request = v.strictObject({ binding: id,id: v.pipe(natural,v.minValue(1),v.maxValue(0xffffffff)),op: v.union([v.literal(4),v.literal(5),v.literal(8),v.literal(9),v.literal(10),v.literal(11)]),target: v.nullable(id),atTick: natural,values: v.strictTuple([number,number,number,number,number,number,number]) });
  const answer = v.union([
    v.strictObject({ status: v.union([v.literal(2),v.literal(3)]) }),
    v.strictObject({ status: v.literal(1),kind: v.literal('walkable'),point }),
    v.strictObject({ status: v.literal(1),kind: v.literal('sight'),visible: v.boolean() }),
    v.strictObject({ status: v.literal(1),kind: v.literal('nearest'),actor: v.nullable(v.strictObject({ id,point,distance: v.pipe(number,v.minValue(0)) })) }),
    v.strictObject({ status: v.literal(1),kind: v.literal('path'),points: v.pipe(v.array(point),v.maxLength(Math.floor(scalars/3))) }),
    v.strictObject({ status: v.literal(1),kind: v.literal('overlap'),bodies: v.pipe(v.array(id),v.maxLength(scalars)) }),
    v.strictObject({ status: v.literal(1),kind: v.literal('ray'),hit: v.nullable(v.strictObject({ point,normal: point,distance: v.pipe(number,v.minValue(0)),body: v.nullable(id) })) }),
  ]);
  return { request,answer,natural,id };
}
export function parseV2QueryAnswer(input: unknown,scalars: number): V2QueryAnswer { return v.parse(schemas(scalars).answer,input); }
/** Defining strict continuation grammar, reused by the original owner's envelope. */
export function createV2QuerySnapshotSchema(limits: { readonly bindings: number; readonly requests: number; readonly scalars: number }): v.GenericSchema<unknown,V2QuerySnapshot> {
  const { request,answer,natural,id } = schemas(limits.scalars);
  return v.strictObject({
    phase: v.pipe(v.number(),v.integer(),v.minValue(-1),v.maxValue(Number.MAX_SAFE_INTEGER)),
    highWater: v.pipe(v.array(v.strictObject({ binding: id,id: v.pipe(natural,v.maxValue(0xffffffff)) })),v.maxLength(limits.bindings)),
    entries: v.pipe(v.array(v.strictObject({ request,reply: v.nullable(v.strictObject({ atTick: natural,answer })) })),v.maxLength(limits.requests)),
  });
}
export function parseV2QuerySnapshot(input: unknown,limits: { readonly bindings: number; readonly requests: number; readonly scalars: number }): V2QuerySnapshot {
  return v.parse(createV2QuerySnapshotSchema(limits),input);
}
