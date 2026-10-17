import * as v from 'valibot';
import { AudioMixExpressionSchema, type AudioMixExpr } from './audioProfiles';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const duration = v.tuple([v.pipe(finite, v.minValue(Number.MIN_VALUE)), v.pipe(finite, v.minValue(Number.MIN_VALUE))]);
const fields = v.pipe(v.record(id, finite), v.check(rows => Object.keys(rows).length <= 32));
/** Bounded scalar weather program. Phase transitions, cadence and random ownership remain engine mechanics. */
export const WeatherProgramSchema = v.pipe(v.strictObject({
  states: v.pipe(v.array(id), v.minLength(1), v.maxLength(32)), next: v.record(id, id),
  length: v.record(id, duration), firstLength: v.exactOptional(v.record(id, duration)),
  soak: finite, dry: finite, salt: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)),
  initial: fields, modes: v.record(id, v.union([v.literal('none'), v.strictObject({hold: v.exactOptional(id), at: v.exactOptional(finite), dry: v.exactOptional(v.boolean())})])),
  sampleFixed: v.exactOptional(v.boolean()), zeroOutputs: v.exactOptional(v.boolean()), forceHold: v.exactOptional(v.boolean()),
  forceAt: v.exactOptional(finite), holdPolicy: v.exactOptional(v.picklist(['all', 'first'])), tickHeld: v.exactOptional(v.boolean()),
  forceWet: v.exactOptional(AudioMixExpressionSchema),
  values: v.pipe(v.array(v.tuple([id, AudioMixExpressionSchema])), v.maxLength(128)),
  outputs: v.record(id, AudioMixExpressionSchema),
  wetProjectile: v.exactOptional(v.strictObject({gravity: finite, drag: finite})),
  air: v.exactOptional(v.strictObject({step:id, system:id, tick:id,
    field:v.strictObject({x:finite,z:finite,frontLength:finite,frontSpeed:finite,secondaryLength:finite}),base:finite,scale:finite})),
}), v.check(row => new Set(row.states).size === row.states.length
  && row.states.every(state => row.states.includes(row.next[state] ?? '') && row.length[state] !== undefined)
  && ['overcast','rain','wet','wind','fog'].every(key => Object.hasOwn(row.initial,key))
  && Object.keys(row.initial).length === Object.keys(row.outputs).length
  && Object.keys(row.initial).every(key => Object.hasOwn(row.outputs,key))
  && Object.values(row.modes).every(mode => mode === 'none' || mode.hold === undefined || row.states.includes(mode.hold))
  && Object.values(row.length).every(range => range[0] <= range[1]), 'complete weather states and numeric outputs'));
function validReferences(row:v.InferOutput<typeof WeatherProgramSchema>):boolean {
  const known=new Set(['t','u','dt','clock',...row.states.map(state=>`state.${state}`),...Object.keys(row.modes).map(mode=>`mode.${mode}`),...Object.keys(row.initial).map(field=>`prev.${field}`)]);
  const valid=(expr:AudioMixExpr,names:ReadonlySet<string>):boolean=>typeof expr==='number'||(typeof expr==='string'?names.has(expr):expr[0]!=='zone'&&expr[0]!=='dist'&&expr.slice(1).every(value=>valid(value,names)));
  if(row.forceWet!==undefined&&!valid(row.forceWet,new Set(['t','prev.wet',...row.states.map(state=>`state.${state}`)])))return false;
  for(const [name,expr] of row.values){if(known.has(name)||/^(state|mode|prev)\./u.test(name)||!valid(expr,known))return false;known.add(name);}
  return Object.values(row.outputs).every(expr=>valid(expr,known));
}
export type WeatherProgram = v.InferOutput<typeof WeatherProgramSchema>;
/** Parse authored or hash-checked product data before creating a weather owner. */
export function parseWeatherProgram(value: unknown): WeatherProgram { const rows=v.parse(WeatherProgramSchema,value);if(!validReferences(rows))throw new RangeError('Invalid weather numeric references');return rows; }
