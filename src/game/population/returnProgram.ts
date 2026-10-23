import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { DecisionModule } from '@wildshard/engine/script/decisionModule';
import { scriptV1Layout, SCRIPT_V1_EVENTS, SCRIPT_V1_COMMANDS } from '@wildshard/format/scriptAbiV1';
import { decisionScriptContract, parseDecisionScripts, SCRIPT_V1_REFERENCE_KINDS, type DecisionScriptRow } from '@wildshard/format/decisionScripts';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SimHost } from '@wildshard/engine/sim';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import * as v from 'valibot';
import { admitScriptContract } from '@wildshard/format/scriptContract';
import { sha256 } from '../plugin/moduleHash';
import { isJsonData } from '@wildshard/format/json';
import { parseReturnProjectionV2 } from '@wildshard/format/returnProjectionV2';
import { ReturnProjectionV2 } from './returnProjectionV2';

const scoped = new WeakMap<Scope, Map<string, { declaration: string; program: ReturnProgram }>>();

/** Detach the closed descriptor before consulting a scope's admitted modules.
 * A declared v2 projection never falls back to legacy bytes on refusal. */
function readProgram(input: unknown): Omit<v.InferOutput<typeof ReturnProgramSchema>,'script'> & { script: DecisionScriptRow } {
  if (!isJsonData(input)) throw new Error('Return program requires JSON data');
  const row = v.parse(ReturnProgramSchema,input),script = parseDecisionScripts([row.script])[0];
  if (script === undefined) throw new Error('Missing return script');
  if (row.v2 !== undefined) {
    const v2 = parseReturnProjectionV2(row.v2);
    if (Object.keys(script.params).length > 0 || script.reads.some(read => read !== 'field' && read !== 'random')
      || (['fields','signals','channels'] as const).some(kind => JSON.stringify(Object.values(script[kind]).sort()) !== JSON.stringify(v2[kind]))) throw new Error('Mismatched return projection declaration');
  }
  return {...row,script};
}

/** Event-only, stateless projections; only explicit v2 rows select ws_project.
 * The caller retains its queue, phase and
 * continuation; the guest can read numeric observations and publish channels.
 * There is no scheduler, actor mutation, timer or private persistent state. */
export class ReturnProgram {
  private readonly module: DecisionModule | null = null;
  private readonly script: DecisionScriptRow;
  private readonly layout: ReturnType<typeof scriptV1Layout>;
  private observations: Readonly<Record<string, number>> = {};
  private candidates: readonly Readonly<Record<string, number>>[] = [];
  private random: Rng | undefined;
  private active = false;
  readonly prepare?: NonNullable<NumericProjection['prepare']>;
  private constructor(input: unknown, floor: (x: number, z: number) => number,owner?: Scope) {
    const row = readProgram(input),script = row.script;
    if (script.side !== 'sim' || script.state.length > 0 || script.tick !== null
      || script.timers.length > 0 || script.on.length !== 1 || script.on[0] !== 'signal'
      || script.commands.some(command => command !== 'channel')
      || script.reads.some(read => !['field', 'random', 'groundHeight', 'radial'].includes(read))) throw new Error('Invalid return projection');
    this.script = script; this.layout = scriptV1Layout(0, Object.keys(script.params).length);
    const fields = Object.values(script.fields).sort();
    const bytes = Uint8Array.from(atob(row.bytes), byte => byte.codePointAt(0) ?? 0);
    if (`blobs/wasm/${sha256(bytes)}.wasm` !== script.module) throw new Error('Return module hash mismatch');
    if (owner?.disposed === true || owner?.disposing === true) throw new Error('Return owner disposed');
    admitScriptContract(bytes, { abi: 1, pages: script.pages });
    if (row.v2 !== undefined) {
      const projection = new ReturnProjectionV2(row.v2,owner);
      this.prepare = projection.prepare.bind(projection);
      return;
    }
    const module: DecisionModule = new DecisionModule(bytes, [0, 0], {
      read: (op, a, b) => {
        if (!this.active) throw new Error('Return read outside a request');
        if (op === 12 && script.reads.includes('random') && a === 0 && b === 0 && this.random !== undefined) return this.random.next();
        const observed = a === 0 ? this.observations : Number.isSafeInteger(a) && a > 0 ? this.candidates[a - 1] : undefined;
        const name = fields[b - 1], value = name === undefined ? undefined : observed?.[name];
        if (op !== 7 || !script.reads.includes('field') || !Number.isInteger(b) || value === undefined || !Number.isFinite(value)) throw new Error('Undeclared return observation');
        return value;
      },
      list: (op, a, b, out, cap) => {
        if (!this.active || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isSafeInteger(out) || out < 0 || out % 8 !== 0
          || !Number.isSafeInteger(cap) || cap < 0 || cap > 96 || out + cap * 8 > module.memory.buffer.byteLength) throw new Error('Invalid return query');
        const values = op === 3 && script.reads.includes('groundHeight') && Math.abs(a) <= 250 && Math.abs(b) <= 250 ? [floor(a, b)]
          : op === 6 && script.reads.includes('radial') && b >= 0 && b <= 10000 ? [Math.sin(a) * b, Math.cos(a) * b] : null;
        if (values === null || values.some(value => !Number.isFinite(value))) throw new Error('Unsupported return query');
        const count = Math.min(cap, values.length);
        for (let i = 0; i < count; i++) module.view.setFloat64(out + i * 8, values[i] ?? 0, true);
        return count;
      },
    }, true); // stateless: rewound around every request, so it shares the page's memory for its page count
    this.module = module;
    if (module.io + this.layout.bytes > module.memory.buffer.byteLength) throw new Error('Return IO outside module');
  }
  private static owned(owner: Scope, input: unknown, floor: (x: number, z: number) => number): ReturnProgram {
    if (owner.disposed || owner.disposing) throw new Error('Return owner disposed');
    const row = readProgram(input),script = row.script;
    // Alias identity follows sorted names; wire object property order is immaterial.
    const named = Object.fromEntries([...SCRIPT_V1_REFERENCE_KINDS, 'params' as const].map(key =>
      [key, Object.fromEntries(Object.entries(script[key] ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))]));
    const declaration = JSON.stringify({ script: decisionScriptContract({ ...script, ...named }), bytes: row.bytes,...(row.v2 === undefined ? {} : {v2:row.v2}) }), modules = scoped.get(owner) ?? new Map<string, { declaration: string; program: ReturnProgram }>();
    const key = row.v2 === undefined ? `1:${script.module}` : `2:${row.v2.artifact.hash}`;
    const previous = modules.get(key);
    if (previous !== undefined) {
      if (previous.declaration !== declaration) throw new Error('Shared return declaration changed');
      return previous.program;
    }
    const program = owner.run(() => new ReturnProgram(row, floor,owner));
    modules.set(key, { declaration, program }); scoped.set(owner, modules);
    owner.onDispose(() => { modules.delete(key); });
    return program;
  }
  /** Built-in terrain owners share one admitted instance per module and scope. */
  static native(host: SimHost, input: unknown): ReturnProgram { return ReturnProgram.owned(host.scope, input, (x, z) => host.groundHeightAt(x, z)); }
  static page(input: unknown, owner?: Scope): ReturnProgram { return owner === undefined ? new ReturnProgram(input, terrainHeight) : ReturnProgram.owned(owner, input, terrainHeight); }

  /** A request is atomic with its borrowed stream. Refusals publish no channel
   * and restore the stream, including traps after one or more terrain retries. */
  project(signal: string, observations: Readonly<Record<string, number>>, random?: Rng, candidates: readonly Readonly<Record<string, number>>[] = []): Readonly<Record<string, number>> {
    if (this.prepare !== undefined) { const result = this.prepare(signal,observations,random,candidates);result.accept();return result.values; }
    if (this.active) throw new Error('Reentrant return request');
    const signalId = Object.values(this.script.signals).sort().indexOf(signal) + 1;
    if (signalId === 0 || Object.values(observations).some(value => !Number.isFinite(value))
      || candidates.length > 8 || candidates.some(candidate => Object.values(candidate).some(value => !Number.isFinite(value)))) throw new Error('Invalid return request');
    const { module, layout } = this;
    if (module === null) throw new Error('Missing return transport');
    const before = random?.snapshot(),base = module.io;
    module.rewind(); module.begin(400000); this.observations = observations; this.candidates = candidates; this.random = random; this.active = true;
    try {
      const set = (slot: number, value: number): void => { module.view.setFloat64(base + slot * 8, value, true); };
      set(0, 0); set(1, 0); set(2, 1); set(3, 0); set(4, 1);
      Object.keys(this.script.params).sort().forEach((name, i) => { set(layout.params + i, this.script.params[name] ?? 0); });
      [SCRIPT_V1_EVENTS.signal, signalId, 0, 0, 0, 0].forEach((value, i) => { set(layout.inbox + i, value); });
      const count = module.invoke('ws_handle'), result: Record<string, number> = {}, channels = Object.values(this.script.channels).sort();
      if (!Number.isSafeInteger(count) || count < 0 || count > 32) throw new Error('Return output bound');
      for (let i = 0; i < count; i++) {
        const command = Array.from({ length: 5 }, (_, j) => module.view.getFloat64(base + (layout.outbox + i * 5 + j) * 8, true));
        const [op, target, id, value, reserved] = command, name = channels[(id ?? 0) - 1];
        if (op !== SCRIPT_V1_COMMANDS.channel || target !== 0 || reserved !== 0 || !Number.isInteger(id) || name === undefined
          || value === undefined || !Number.isFinite(value) || Object.hasOwn(result, name)) throw new Error('Invalid return output');
        result[name] = value;
      }
      return result;
    } catch (error) { if (before !== undefined) random?.restore(before); throw error; }
    finally { this.active = false; this.observations = {}; this.candidates = []; this.random = undefined; module.rewind(); }
  }
}

/** Ten-Hz motion observation with a reused frame. The guest owns velocity caps
 * and smoothing; renderer frames borrow the last projected scalar. */
export class ProjectedMotionSample {
  private initialized = false;
  private readonly frame = { dt: 0, x: 0, z: 0, px: 0, pz: 0, speed: 0 };
  constructor(private readonly program: ReturnProgram, private readonly signal: string) {}
  update(dt: number, x: number, z: number): number {
    const frame = this.frame;
    if (!this.initialized) { frame.px = x; frame.pz = z; this.initialized = true; }
    frame.dt += dt; frame.x = x; frame.z = z;
    if (frame.dt + 1e-9 >= .1) {
      frame.speed = this.program.project(this.signal, frame)['speed'] ?? frame.speed;
      frame.px = x; frame.pz = z; frame.dt = 0;
    }
    return frame.speed;
  }
}


/** Numeric projections retain the existing caller's decision slots. A v2
 * transport prepares its RNG candidate until retained columns also validate. */
export interface NumericProjection {
  readonly project:(signal:string,observations:Readonly<Record<string,number>>,random?:Rng,candidates?:readonly Readonly<Record<string,number>>[])=>Readonly<Record<string,number>>;
  readonly prepare?:(signal:string,observations:Readonly<Record<string,number>>,random?:Rng,candidates?:readonly Readonly<Record<string,number>>[])=>{
    readonly values:Readonly<Record<string,number>>;readonly accept:()=>void;
  };
}

/** Native continuation for admitted numeric projections. The guest owns rules;
 * rows name retained channels and event aliases. Both live arena clocks and
 * practice courses use the same state owner and optional ten-Hz sampling. */
export class ProjectedState<S extends Record<string,number> = Record<string,number>> {
  readonly state:S;
  private elapsed=0;
  private readonly retain:Readonly<Record<string,string>>;
  constructor(private readonly row:{ readonly initial:S; readonly parameters?:Readonly<Record<string,number>>;
    readonly retain?:Readonly<Record<string,string>>; readonly outputs?:readonly string[]; readonly signals?:Readonly<Record<string,string>>; readonly signal?:string },
    private readonly program:NumericProjection) {
    this.state={...row.initial};this.retain=row.retain??Object.fromEntries(Object.keys(row.initial).map(key=>[key,key]));
    if(Object.values(this.retain).some(key=>!Object.hasOwn(row.initial,key)))throw new Error('Missing projection state slot');
  }
  value(key:string):number {const value=this.state[key];if(value===undefined)throw new Error('Unknown projection state slot');return value;}
  set(values:Readonly<Record<string,number>>):void {
    if(Object.entries(values).some(([key,value])=>!Object.hasOwn(this.row.initial,key)||!Number.isFinite(value)))throw new Error('Invalid projection state');
    Object.assign(this.state,values);
  }
  reset(values:Readonly<Record<string,number>>={}):void {this.elapsed=0;Object.assign(this.state,this.row.initial);this.set(values);}
  /** Reset retained slots, then let the guest interpret reset observations. */
  restart(frame:Readonly<Record<string,number>>={}):Readonly<Record<string,number>> {this.reset();return this.event('reset',frame);}
  event(event:string,frame:Readonly<Record<string,number>>={},random?:Rng,candidates:readonly Readonly<Record<string,number>>[]=[]):Readonly<Record<string,number>> {
    const signal=this.row.signals===undefined?event:this.row.signals[event];if(signal===undefined)throw new Error('Missing projection event');
    const input={...this.row.parameters,...this.state,...frame},prepared=this.program.prepare?.(signal,input,random,candidates);
    const out=prepared?.values??this.program.project(signal,input,random,candidates),next:Record<string,number>={};
    if(this.row.outputs?.some(key=>!Number.isFinite(out[key]))===true)throw new Error('Missing required projection output');
    for(const [channel,slot]of Object.entries(this.retain)){const value=out[channel];if(value!==undefined)next[slot]=value;}
    if(Object.entries(next).some(([key,value])=>!Object.hasOwn(this.row.initial,key)||!Number.isFinite(value)))throw new Error('Invalid projection state');
    prepared?.accept();this.set(next);return out;
  }
  project(frame:Readonly<Record<string,number>>,random?:Rng,candidates:readonly Readonly<Record<string,number>>[]=[]):Readonly<Record<string,number>> {
    if(this.row.signal===undefined)throw new Error('Missing projection signal');return this.event(this.row.signal,frame,random,candidates);
  }
  /** At most one decision each 100 ms; long frames produce no catch-up burst. */
  step(dt:number,frame:Readonly<Record<string,number>>):{dt:number;values:Readonly<Record<string,number>>} {
    this.elapsed+=dt;if(this.elapsed+1e-9<.1)return {dt:0,values:{}};
    const step=this.elapsed;this.elapsed=0;return {dt:step,values:this.event('step',{...frame,dt:step})};
  }
}
