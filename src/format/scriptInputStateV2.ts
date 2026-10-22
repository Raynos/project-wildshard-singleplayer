/** Stable-identity H4 inbox continuation. Handles belong only to a captured
 * call and never enter this saved envelope. */
import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(),v.minLength(1),v.maxLength(256));
const tick = v.pipe(v.number(),v.safeInteger(),v.minValue(0));
const sequence = v.pipe(tick,v.minValue(1),v.maxValue(0xffffffff));
const finite = v.pipe(v.number(),v.finite());
const Edge = v.strictObject({ player: id,action: id,atTick: tick,sequence,phase: v.union([v.literal(1),v.literal(2),v.literal(3)]),x: finite,y: finite });
const Event = v.strictObject({ binding: id,kind: sequence,subject: v.nullable(id),player: v.nullable(id),atTick: tick,sequence,
  values: v.strictTuple([finite,finite,finite,finite]) });
export const ScriptInputStateV2Schema = v.strictObject({ version: v.literal(1),sequence: v.pipe(tick,v.maxValue(0xffffffff)),
  receiptTick: v.pipe(v.number(),v.safeInteger(),v.minValue(-1)),deliveryTick: v.pipe(v.number(),v.safeInteger(),v.minValue(-1)),
  edges: v.pipe(v.array(Edge),v.maxLength(4096)),events: v.pipe(v.array(Event),v.maxLength(4096)) });
export type ScriptInputStateV2 = v.InferOutput<typeof ScriptInputStateV2Schema>;
export function parseScriptInputStateV2(input: unknown): ScriptInputStateV2 {
  if (!isJsonData(input)) throw new Error('V2 input state must be plain JSON');return v.parse(ScriptInputStateV2Schema,input);
}
