import * as v from 'valibot';
import { AudioMixExpressionSchema, type AudioMixExpr } from './audioProfiles';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const duration = v.tuple([v.pipe(finite, v.minValue(Number.MIN_VALUE)), v.pipe(finite, v.minValue(Number.MIN_VALUE))]);
const fields = v.pipe(v.record(id, finite), v.check(rows => Object.keys(rows).length <= 32));
/** Fixed-step native wind/weather binding, including gameplay cue data. */
export const WeatherWorldSchema = v.strictObject({
  step: id, scareRadius: v.pipe(finite,v.minValue(0)), windReference: v.pipe(finite,v.minValue(Number.MIN_VALUE)),
  light: v.strictObject({ base: finite, storm: finite, ramps: v.pipe(v.array(v.tuple([finite,finite,finite])),v.maxLength(8)) }),
  hit: v.strictObject({ ask: v.literal('weather.damage'), tags: v.array(v.custom<`${string}.${string}`>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value))),
    cause: v.strictObject({ kind: id,label: id,text: id }),toast: id }),
});
/** The physical wind's own continuation; never shared with a renderer global. */
export const WindStateSchema = v.strictObject({ speed: finite,dir: finite,gustiness: finite,time: finite,travel: finite,wander: v.boolean(),baseSpeed: finite,baseDir: finite,
  target: v.strictObject({ speed: finite,dir: finite,gustiness: finite,rate: finite }) });
const actionSchema = v.strictObject({target:id, when:v.exactOptional(AudioMixExpressionSchema),
  value:v.union([AudioMixExpressionSchema,v.strictObject({range:v.tuple([AudioMixExpressionSchema,AudioMixExpressionSchema])})])});
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
  registers:v.exactOptional(fields),
  actions:v.exactOptional(v.pipe(v.record(id,v.pipe(v.array(actionSchema),v.maxLength(64))),v.check(rows=>Object.keys(rows).length<=16))),
  page:v.exactOptional(v.strictObject({id,after:v.array(id),before:v.array(id),tick:id})),
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
  const actionInputs=new Set(['t','u','dt',...row.states.map(state=>`state.${state}`),...Object.keys(row.modes).map(mode=>`mode.${mode}`),...Object.keys(row.initial).map(field=>`output.${field}`),...Object.keys(row.registers??{}).map(field=>`register.${field}`)]);
  return Object.values(row.outputs).every(expr=>valid(expr,known)) && Object.values(row.actions??{}).flat().every(action=>
    Object.hasOwn(row.registers??{},action.target) && (action.when===undefined||valid(action.when,actionInputs)) &&
    (typeof action.value==='object'&&'range' in action.value?action.value.range.every(expr=>valid(expr,actionInputs)):valid(action.value,actionInputs)));
}
export type WeatherProgram = v.InferOutput<typeof WeatherProgramSchema>;
/** Parse authored or hash-checked product data before creating a weather owner. */
export function parseWeatherProgram(value: unknown): WeatherProgram { const rows=v.parse(WeatherProgramSchema,value);if(!validReferences(rows))throw new RangeError('Invalid weather numeric references');return rows; }

const name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u), v.maxLength(64));
/** A reaction's numeric source: a continuation register, a caller input, the step's own output, a state flag, or the clock. */
const source = v.pipe(v.string(), v.regex(/^(?:(?:register|input|output|state)\.[a-zA-Z][a-zA-Z0-9]*|dt|phaseT|phaseLen)$/u));
const named = v.pipe(v.array(v.tuple([name, source])), v.maxLength(32));
/**
 * Weather reactions (G474): what a weather continuation does at a bounded cadence beyond its phases, as ordered steps of one
 * admitted return program (`script` and its module `bytes`). Each decision tick runs the continuation's `actions` list (unless its register is set),
 * then every step whose `when` source is non-zero: the step's `observe` fields (and, with `probe`, the nearest ≤ 8 declared
 * points within the probed circle as candidates `x z top`) go to its `signal`; each `write` copies an output to a register or
 * the phase clock (`phaseT`), and each `emit` raises an event while its `when` output is present. `active` states make the
 * weather "on" for its readers; `flash` names the register they may raise; `shelter` circles grow by `margin` and mark the
 * caller's `input.sheltered`.
 */
export const WeatherReactionsSchema = v.strictObject({
  version: v.literal(1), hz: v.pipe(finite, v.minValue(1), v.maxValue(10)), script: v.unknown(), bytes: v.string(),
  actions: v.exactOptional(v.strictObject({ event: id, unless: v.exactOptional(name) })),
  active: v.pipe(v.array(id), v.maxLength(32)), flash: name,
  shelter: v.strictObject({ margin: v.pipe(finite, v.minValue(0)), circles: v.pipe(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), v.maxLength(256)) }),
  points: v.pipe(v.array(v.tuple([finite, finite, finite])), v.maxLength(8192)),
  steps: v.pipe(v.array(v.strictObject({
    signal: name, when: v.exactOptional(source), observe: named,
    probe: v.exactOptional(v.strictObject({ x: source, z: source, radius: v.union([source, v.pipe(finite, v.minValue(0))]) })), random: v.optional(v.boolean(), false),
    write: v.pipe(v.array(v.tuple([name, v.pipe(v.string(), v.regex(/^(?:register\.[a-zA-Z][a-zA-Z0-9]*|phaseT)$/u))])), v.maxLength(32)),
    emit: v.pipe(v.array(v.strictObject({ event: name, when: name, fields: named })), v.maxLength(8)),
  })), v.minLength(1), v.maxLength(16)),
  /** the HUD's weather chip (the first row of the current state, `within` seconds of its end when given; `{left}` the
   *  phase's mm:ss, `{wind}` the wind in m/s) and GET LOW while the `low` register is 1 */
  hud: v.exactOptional(v.strictObject({ chips: v.pipe(v.array(v.strictObject({ state: id, within: v.exactOptional(v.pipe(finite, v.minValue(0))),
    title: v.pipe(v.string(), v.maxLength(64)), tone: v.picklist(['soon', 'storm', 'clearing']) })), v.maxLength(16)), sub: v.pipe(v.string(), v.maxLength(64)), low: name })),
});
export type WeatherReactionRows = v.InferOutput<typeof WeatherReactionsSchema>;
/** Admit reaction rows against the continuation they drive: every register they read or write is the program's own. */
export function parseWeatherReactions(value: unknown, program: WeatherProgram): WeatherReactionRows {
  const rows = v.parse(WeatherReactionsSchema, value), registers = program.registers ?? {};
  const known = (ref: string): boolean => !ref.startsWith('register.') || Object.hasOwn(registers, ref.slice(9));
  const refs = rows.steps.flatMap(step => [step.when ?? '', ...step.observe.map(row => row[1]), ...step.write.map(row => row[1]),
    ...(step.probe === undefined ? [] : [step.probe.x, step.probe.z, String(step.probe.radius)]), ...step.emit.flatMap(row => row.fields.map(field => field[1]))]);
  if (!refs.every(known) || !Object.hasOwn(registers, rows.flash) || (rows.actions?.unless !== undefined && !Object.hasOwn(registers, rows.actions.unless))
    || !rows.active.every(state => program.states.includes(state)) || (rows.hud !== undefined && (!Object.hasOwn(registers, rows.hud.low) || !rows.hud.chips.every(chip => program.states.includes(chip.state)))) || (rows.actions !== undefined && program.actions?.[rows.actions.event] === undefined))
    throw new RangeError('Invalid weather reaction references');
  return rows;
}
