import { ReturnProgramSchema } from '@wildshard/format/namedJsonContracts';
import { DecisionModule } from '@wildshard/engine/script/decisionModule';
import { scriptV1Layout, SCRIPT_V1_EVENTS, SCRIPT_V1_COMMANDS } from '@wildshard/format/scriptAbiV1';
import { parseDecisionScripts, SCRIPT_V1_REFERENCE_KINDS, type DecisionScriptRow } from '@wildshard/format/decisionScripts';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SimHost } from '@wildshard/engine/sim';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import * as v from 'valibot';
import { admitScriptContract } from '@wildshard/format/scriptContract';
import { sha256 } from '../plugin/moduleHash';

const scoped = new WeakMap<Scope, Map<string, { declaration: string; program: ReturnProgram }>>();

/** Event-only, stateless v1 projections. The caller retains its queue, phase and
 * continuation; the guest can read numeric observations and publish channels.
 * There is no scheduler, actor mutation, timer or private persistent state. */
export class ReturnProgram {
  private readonly module: DecisionModule;
  private readonly script: DecisionScriptRow;
  private readonly layout: ReturnType<typeof scriptV1Layout>;
  private observations: Readonly<Record<string, number>> = {};
  private candidates: readonly Readonly<Record<string, number>>[] = [];
  private random: Rng | undefined;
  private active = false;
  private constructor(input: unknown, private readonly floor: (x: number, z: number) => number) {
    const row = v.parse(ReturnProgramSchema, input), script = parseDecisionScripts([row.script])[0];
    if (script?.side !== 'sim' || script.state.length > 0 || script.tick !== null
      || script.timers.length > 0 || script.on.length !== 1 || script.on[0] !== 'signal'
      || script.commands.some(command => command !== 'channel')
      || script.reads.some(read => !['field', 'random', 'groundHeight', 'radial'].includes(read))) throw new Error('Invalid return projection');
    this.script = script; this.layout = scriptV1Layout(0, Object.keys(script.params).length);
    const fields = Object.values(script.fields).sort();
    const bytes = Uint8Array.from(atob(row.bytes), byte => byte.codePointAt(0) ?? 0);
    if (`blobs/wasm/${sha256(bytes)}.wasm` !== script.module) throw new Error('Return module hash mismatch');
    admitScriptContract(bytes, { abi: 1, pages: script.pages });
    this.module = new DecisionModule(bytes, [0, 0], {
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
          || !Number.isSafeInteger(cap) || cap < 0 || cap > 96 || out + cap * 8 > this.module.memory.buffer.byteLength) throw new Error('Invalid return query');
        const values = op === 3 && script.reads.includes('groundHeight') && Math.abs(a) <= 250 && Math.abs(b) <= 250 ? [this.floor(a, b)]
          : op === 6 && script.reads.includes('radial') && b >= 0 && b <= 10000 ? [Math.sin(a) * b, Math.cos(a) * b] : null;
        if (values === null || values.some(value => !Number.isFinite(value))) throw new Error('Unsupported return query');
        const count = Math.min(cap, values.length);
        for (let i = 0; i < count; i++) this.module.view.setFloat64(out + i * 8, values[i] ?? 0, true);
        return count;
      },
    });
    if (this.module.io + this.layout.bytes > this.module.memory.buffer.byteLength) throw new Error('Return IO outside module');
  }
  private static owned(owner: Scope, input: unknown, floor: (x: number, z: number) => number): ReturnProgram {
    if (owner.disposed) throw new Error('Return owner disposed');
    const row = v.parse(ReturnProgramSchema, input), script = parseDecisionScripts([row.script])[0];
    if (script === undefined) throw new Error('Missing return script');
    const { sourceHash: _sourceHash, ...executable } = script;
    // Alias identity follows sorted names; wire object property order is immaterial.
    const named = Object.fromEntries([...SCRIPT_V1_REFERENCE_KINDS, 'params' as const].map(key =>
      [key, Object.fromEntries(Object.entries(script[key]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))]));
    const declaration = JSON.stringify({ script: { ...executable, ...named }, bytes: row.bytes }), modules = scoped.get(owner) ?? new Map<string, { declaration: string; program: ReturnProgram }>();
    const previous = modules.get(script.module);
    if (previous !== undefined) {
      if (previous.declaration !== declaration) throw new Error('Shared return declaration changed');
      return previous.program;
    }
    const program = owner.run(() => new ReturnProgram(input, floor));
    modules.set(script.module, { declaration, program }); scoped.set(owner, modules);
    owner.onDispose(() => { modules.delete(script.module); });
    return program;
  }
  /** Built-in terrain owners share one admitted instance per module and scope. */
  static native(host: SimHost, input: unknown): ReturnProgram { return ReturnProgram.owned(host.scope, input, (x, z) => host.groundHeightAt(x, z)); }
  static page(input: unknown, owner?: Scope): ReturnProgram { return owner === undefined ? new ReturnProgram(input, terrainHeight) : ReturnProgram.owned(owner, input, terrainHeight); }

  /** A request is atomic with its borrowed stream. Refusals publish no channel
   * and restore the stream, including traps after one or more terrain retries. */
  project(signal: string, observations: Readonly<Record<string, number>>, random?: Rng, candidates: readonly Readonly<Record<string, number>>[] = []): Readonly<Record<string, number>> {
    if (this.active) throw new Error('Reentrant return request');
    const signalId = Object.values(this.script.signals).sort().indexOf(signal) + 1;
    if (signalId === 0 || Object.values(observations).some(value => !Number.isFinite(value))
      || candidates.length > 8 || candidates.some(candidate => Object.values(candidate).some(value => !Number.isFinite(value)))) throw new Error('Invalid return request');
    const before = random?.snapshot(), { module, layout } = this, base = module.io;
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

/** Cache boolean event projections on a bounded ten-Hz clock. Rows select signal
 * ids and static observations; callers provide only the current numeric frame. */
export class EventConditions {
  private elapsed = 0; private initialized = false;
  private readonly values = new Map<string, boolean>();
  constructor(private readonly program: ReturnProgram, private readonly rows: readonly {
    readonly id: string; readonly signal: string; readonly observations: Readonly<Record<string, number>>;
  }[]) {
    if (rows.length > 64 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Invalid event condition rows');
  }
  update(dt: number, observations: Readonly<Record<string, number>>): void {
    this.elapsed += dt;
    if (this.initialized && this.elapsed + 1e-9 < .1) return;
    this.initialized = true; this.elapsed = 0;
    for (const row of this.rows) this.values.set(row.id, this.program.project(row.signal, { ...observations, ...row.observations })['accept'] === 1);
  }
  holds(id: string): boolean { return this.values.get(id) ?? false; }
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
