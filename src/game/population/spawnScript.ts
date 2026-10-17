import * as v from 'valibot';
import type { ShardProduct } from '../shardfile/shardProduct';
import { outputDescriptor } from '../shardfile/outputDescriptor';
import { DecisionHost, type DecisionContext, type DecisionScript, type DecisionWorld, type DecisionSnapshot } from '@wildshard/engine/script/decision';
import { ActorMoveRunner } from '@wildshard/engine/ai/moves';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import { Rng } from '@wildshard/engine/core/rng';
import { DECISION_PLAYER_HANDLE, decisionBindingMap } from '@wildshard/format/decisionBindings';
import { parseSpawnScript, SpawnScriptsSchema, spawnScriptRegistries, type SpawnScriptRows } from '@wildshard/format/spawnScripts';
import { SCRIPT_V1_READS, SCRIPT_V1_LISTS, type ScriptV1Command, type ScriptV1ReadName, type ScriptV1ListName } from '@wildshard/format/scriptAbiV1';
import { admitScriptContract } from '@wildshard/format/scriptContract';
import { populationRoster } from './roster';
import { ANIMAL_STATES, type AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';

interface Point { readonly x: number; readonly y: number; readonly z: number }
/** Internal body authority. Only built-in native/page adapters construct it; shard-facing installers take rows. */
interface SpawnBodyOwner {
  spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => AnimalSim;
  retire: (actor: AnimalSim) => void;
  actor: (id: string) => AnimalSim | null;
  height: (x: number, z: number) => number;
  available: () => number;
}
interface Effect { readonly kind: 'cue' | 'retire'; readonly id: number; readonly at: Point }
interface Motion { readonly id: number; readonly target: number; readonly runner: ActorMoveRunner }
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const pair = v.tuple([natural, finite]);
const Saved = v.strictObject({ version: v.literal(2), contract: v.string(), decision: v.custom<DecisionSnapshot>(input => typeof input === 'object' && input !== null),
  actors: v.array(v.tuple([natural, v.string()])), fields: v.array(v.tuple([natural, natural, finite])),
  channels: v.array(pair), force: v.pipe(natural, v.maxValue(8)), elapsed: v.pipe(finite, v.minValue(0), v.maxValue(1 / 60)),
  moves: v.array(v.strictObject({ actor: natural, id: natural, target: natural, state: v.unknown() })),
});
function value<T>(input: T | undefined, reason: string): T { if (input === undefined) throw new Error(`Spawn script: ${reason}`); return input; }

/** V1 commands over existing actor lifetimes. Logical slots never replace native identity allocation or its RNG stream.
 * This internal runner has no shard hooks: native/page installers supply the real built-in body owner. */
export class SpawnScript {
  readonly host: DecisionHost;
  private readonly rows: SpawnScriptRows;
  private readonly handles = new Map<number, AnimalSim>();
  private readonly fields = new Map<string, number>();
  private readonly channels = new Map<number, number>();
  private readonly motions = new Map<number, Motion>();
  private readonly contract: string;
  private point: Point = { x: 0, y: 0, z: 0 };
  private night = 0;
  private maximum = 0;
  private forced = 0;
  private elapsed = 0;
  private tick = 0;
  private effects: Effect[] = [];
  private readonly flags = new Set<string>();
  private disabledReason: string | null = null;
  private readonly controlState: AnimalSim['state'];
  /** The decision host's final refusal, exposed without a callback into content. */
  get failure(): string | null { return this.disabledReason; }
  private constructor(input: unknown, private readonly bodies: SpawnBodyOwner) {
    const rows = parseSpawnScript(input); this.rows = rows;
    this.controlState = v.parse(v.picklist(ANIMAL_STATES), rows.controlState);
    const registries = spawnScriptRegistries(rows), map = decisionBindingMap(rows.script, registries);
    const bytes = Uint8Array.from(atob(rows.bytes), byte => byte.codePointAt(0) ?? 0);
    admitScriptContract(bytes, { abi: 1, pages: rows.script.pages });
    this.contract = JSON.stringify({ ...rows, bytes: undefined });
    const script: DecisionScript = { ...rows.script, ids: map.ids,
      state: rows.script.state.map(slot => { if (slot.scope === 'local') throw new Error('Local spawn state'); return { ...slot, scope: slot.scope }; }),
      reads: rows.script.reads.filter((name): name is ScriptV1ReadName => Object.hasOwn(SCRIPT_V1_READS, name)),
      lists: rows.script.reads.filter((name): name is ScriptV1ListName => Object.hasOwn(SCRIPT_V1_LISTS, name)),
    };
    const world: DecisionWorld = { read: (op, a, b) => this.read(op, a, b), list: (op, a, b, out) => {
      if (op === 6) { if (b < 0 || b > 10000) throw new Error('Radial query bounds'); out[0] = Math.sin(a) * b; out[1] = Math.cos(a) * b; return 2; }
      if (op !== 3) throw new Error('Unsupported population list'); out[0] = bodies.height(a, b); return 1;
    }, prepare: (commands, context) => this.prepare(commands, context), failed: (_mode, _context, reason) => { this.disabledReason = reason; } };
    this.host = new DecisionHost({ scripts: [script], bindings: [{ id: 1, script: script.id, self: 0,
      actors: Object.values(map.ids.actors ?? {}), instance: 0 }], modules: new Map([[script.module, bytes]]), seed: [rows.seed >>> 0, 0],
      world, limits: { fuelPerCall: 2000000, fuelPerTick: 8000000 } });
    this.host.enqueue(1, [1, 0, 0, 0, 0, 0]);
  }
  /** Native binding takes existing platform authorities and rows, never per-shard ports. */
  static native(host: SimHost, input: unknown): SpawnScript {
    const rows = parseSpawnScript(input), roster = populationRoster(host, rows.roster);
    for (const row of rows.species) roster.validateSpawn(row.kind, row.variant);
    return new SpawnScript(rows, { spawn: roster.spawn, retire: actor => {
      const body = roster.actor(actor.entityId); if (body !== actor) throw new Error('Foreign native script actor');
      roster.retire(body);
    }, actor: roster.actor,
      height: (x, z) => host.groundHeightAt(x, z), available: roster.available });
  }
  /** Client-only binding to the actual AnimalManager. Its existing spawn/retire path owns bodies and draws. */
  static page(animals: AnimalManager, input: unknown): SpawnScript {
    const made = new Map<string, Animal>();
    return new SpawnScript(input, { spawn: (kind, x, z, yaw, variant) => {
      const actor = animals.spawn(kind, x, z, yaw, variant); made.set(actor.entityId, actor); return actor;
    }, retire: actor => { const real = made.get(actor.entityId); if (real === undefined) throw new Error('Foreign page spawn retirement');
      animals.retire(real); made.delete(actor.entityId); }, actor: id => made.get(id) ?? null, height: terrainHeight,
      available: () => 16384 - animals.animals.length });
  }
  private actor(handle: number): AnimalSim | undefined { return this.handles.get(handle); }
  private position(handle: number): Point { return handle === DECISION_PLAYER_HANDLE ? this.point : this.actor(handle)?.position ?? { x: 0, y: 0, z: 0 }; }
  private field(actor: number, id: number): number {
    const row = value(this.rows.fields[id - 1], 'field'), body = this.actor(actor);
    if (row.source === 'night') return this.night;
    if (row.source === 'limit') return this.maximum;
    if (row.source === 'force') return this.forced;
    if (row.source === 'scripted') return Number(body?.scripted ?? false);
    if (row.source === 'lookWeight') return body?.lookWeight ?? 0;
    return this.fields.get(`${actor}:${id}`) ?? 0;
  }
  private read(op: number, a: number, b: number): number {
    if (op === 9) return DECISION_PLAYER_HANDLE;
    if (op === 10) return Number(this.flags.has(value(this.rows.flags[a - 1], 'flag')));
    if (op === 7) return this.field(a, b);
    if (op === 15) return Number(this.motions.has(a));
    const body = this.actor(a), point = this.position(a);
    if (op === 1) return point.x; if (op === 2) return point.y; if (op === 3) return point.z;
    if (op === 4) return body?.yaw ?? 0;
    if (op === 5) return body === undefined ? 0 : body.hp / body.maxHp;
    if (op === 6) return Number(body?.alive ?? false);
    if (op === 8) { const other = this.position(b); return Math.hypot(point.x - other.x, point.z - other.z); }
    throw new Error('Unsupported population read');
  }
  /** Validate the complete batch and resolve its row/species/site identities before any draw, body or flag changes. */
  private prepare(commands: readonly ScriptV1Command[], _context: DecisionContext): { commit: () => void } {
    const fields = new Map(this.fields), pending = new Set<number>(), retiring = new Set<number>(), operations: (() => void)[] = [];
    let capacity = this.bodies.available();
    const slot = (name: string): number => value(this.rows.slots.find(row => row.id === name), 'slot').handle;
    for (const [op, actor, a, b, c] of commands) {
      if (op === 4) {
        const row = value(this.rows.fields[a - 1], 'field');
        if (['night', 'limit'].includes(row.source) || Math.abs(b) > 10000 || c !== 0) throw new Error('Population field authority');
        if (row.source === 'scripted' && b !== 0 && b !== 1) throw new Error('Population control bounds');
        if (row.source === 'force' && (b < 0 || b > 8 || !Number.isInteger(b))) throw new Error('Population force bound');
        if ((row.source === 'scripted' || row.source === 'lookWeight') && !pending.has(actor) && this.actor(actor) === undefined) throw new Error('Missing controlled body');
        fields.set(`${actor}:${a}`, b);
        operations.push(() => {
          const body = this.actor(actor);
          if (row.source === 'force') this.forced = b;
          else if (row.source === 'scripted') {
            if (body === undefined) throw new Error('Missing controlled body');
            body.scripted = b === 1;
            const state = this.controlState;
            if (body.scripted) { body.herd = -1; body.state = state; }
            else if (body.alive && body.state === state) body.state = 'alert';
          } else if (row.source === 'lookWeight') { if (body !== undefined) body.lookWeight = b; }
          else this.fields.set(`${actor}:${a}`, b);
        });
      } else if (op === 5) {
        const row = value(this.rows.spawns[a - 1], 'spawn row'), species = value(this.rows.species.find(item => item.id === row.species), 'species');
        const site = value(this.rows.sites.find(item => item.id === row.site), 'site'), handle = slot(site.slot);
        if (b !== 0 || c !== 0 || pending.has(handle) || (this.actor(handle)?.alive === true && !retiring.has(handle)) || capacity < 1) throw new Error('Occupied or invalid spawn slot');
        capacity--;
        const coordinate = (source: 'x' | 'z'): number => {
          const id = this.rows.fields.findIndex(field => field.source === source) + 1;
          return value(fields.get(`${handle}:${id}`), 'dynamic site coordinate');
        };
        const x = site.point?.[0] ?? coordinate('x'), z = site.point?.[1] ?? coordinate('z');
        if (![x, z].every(n => Number.isFinite(n) && Math.abs(n) <= 10000)) throw new Error('Spawn site bound');
        pending.add(handle);
        operations.push(() => {
          const face = site.face === 'player' ? this.point : { x: site.face[0], z: site.face[1] };
          const body = this.bodies.spawn(species.kind, x, z, Math.atan2(face.x - x, face.z - z), species.variant);
          this.handles.set(handle, body); this.motions.delete(handle);
          if (this.rows.script.on.includes('spawned')) this.host.enqueue(1, [17, handle, a, 0, 0, 0]);
        });
      } else if (op === 6) {
        const body = value(this.actor(actor), 'retirement body');
        if (retiring.has(actor)) throw new Error('Duplicate population retirement');
        retiring.add(actor); capacity++;
        operations.push(() => { this.effects.push({ kind: 'retire', id: actor, at: { x: body.position.x, y: body.position.y, z: body.position.z } });
          this.bodies.retire(body); this.handles.delete(actor); this.motions.delete(actor); });
      } else if (op === 1) {
        const row = value(this.rows.moves[a - 1], 'move');
        if (row.kind !== 'stalk') throw new Error('Population movement requires a stalk row');
        if (!pending.has(actor) && this.actor(actor) === undefined) throw new Error('Missing moving actor');
        if (b !== DECISION_PLAYER_HANDLE && b !== 0) throw new Error('Population move target');
        operations.push(() => { this.motions.set(actor, { id: a, target: b, runner: new ActorMoveRunner(row, value(this.actor(actor), 'move body')) }); });
      } else if (op === 3) {
        operations.push(() => { this.motions.delete(actor); const body = this.actor(actor); body?.setMotion(body.yaw, 0); });
      } else if (op === 7) {
        const name = value(this.rows.flags[a - 1], 'flag'); operations.push(() => { if (b === 1) this.flags.add(name); else this.flags.delete(name); });
      } else if (op === 12) {
        value(this.rows.cues[a - 1], 'cue'); operations.push(() => { this.effects.push({ kind: 'cue', id: a, at: { ...this.position(actor) } }); });
      } else if (op === 13) {
        value(this.rows.channels[a - 1], 'channel'); operations.push(() => { this.channels.set(a, b); });
      } else throw new Error('Unsupported population command');
    }
    return { commit: () => { for (const operation of operations) operation(); } };
  }
  /** Existing native/page owners supply observations as values; the guest cannot call back into shard code. */
  advance(dt: number, point: Point, night: number, maximum: number, flags: readonly string[]): void {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1) throw new Error('Invalid population elapsed time');
    this.point = point; this.night = night; this.maximum = maximum;
    this.flags.clear(); for (const flag of flags) this.flags.add(flag);
    this.effects = []; this.elapsed += dt;
    while (this.elapsed + Number.EPSILON >= 1 / 60) {
      this.elapsed = Math.max(0, this.elapsed - 1 / 60); this.host.step(++this.tick);
      for (const [handle, motion] of this.motions) {
        const body = this.actor(handle); if (body === undefined || !body.alive) { this.motions.delete(handle); continue; }
        const site = this.rows.sites.find(row => this.rows.slots.find(slot => slot.id === row.slot)?.handle === handle);
        const face = site?.face;
        const target = motion.target !== 0 ? this.position(motion.target) : face === undefined || face === 'player' ? this.point : { x: face[0], y: body.position.y, z: face[1] };
        const frame = motion.runner.step({ body, target });
        if (frame.steering !== undefined) { const steer = frame.steering; body.setMotion(steer.yaw, steer.speed, steer.turn); }
        if (frame.done !== undefined) { this.motions.delete(handle); if (this.rows.script.on.includes('move.done')) this.host.enqueue(1, [10, handle, motion.id, Number(frame.done), 0, 0]); }
      }
    }
  }
  /** Debug force is a bounded input; normal decision cadence and spawn quotas still apply. */
  force(): void { this.forced = Math.min(8, this.maximum || this.rows.maximum); }
  channel(id: number): number { return this.channels.get(id) ?? 0; }
  hasFlag(name: string): boolean { return this.flags.has(name); }
  drainEffects(): readonly Effect[] { const effects = this.effects; this.effects = []; return effects; }
  snapshot(): string { return JSON.stringify({ version: 2, contract: this.contract, decision: this.host.snapshot(),
    actors: [...this.handles].map(([handle, body]) => [handle, body.entityId]),
    fields: [...this.fields].map(([key, n]) => { const parts = key.split(':'); return [Number(parts[0]), Number(parts[1]), n]; }), channels: [...this.channels], force: this.forced, elapsed: this.elapsed,
    moves: [...this.motions].map(([actor, motion]) => ({ actor, id: motion.id, target: motion.target, state: motion.runner.snapshot() })) }); }
  /** Restore body references only after the real roster has reinstalled them. No draws, spawns, guest calls or effects. */
  restore(input: SimValue): void {
    const raw: unknown = typeof input === 'string' ? JSON.parse(input) : input;
    const migrated = this.migrate(raw), saved = v.parse(Saved, migrated);
    if (saved.contract !== this.contract) throw new Error('Incompatible population script continuation');
    const fields = new Map<string, number>(), channels = new Map<number, number>();
    for (const [actor, id, n] of saved.fields) {
      const field = value(this.rows.fields[id - 1], 'restored field'), key = `${actor}:${id}`;
      if (!this.rows.slots.some(row => row.handle === actor) || !['x', 'z'].includes(field.source) || fields.has(key) || Math.abs(n) > 10000) throw new Error('Invalid population site continuation');
      fields.set(key, n);
    }
    for (const [id, n] of saved.channels) {
      if (!Number.isInteger(id) || this.rows.channels[id - 1] === undefined || channels.has(id)) throw new Error('Invalid population channel continuation');
      channels.set(id, n);
    }
    const actors = new Map<number, AnimalSim>();
    for (const [handle, id] of saved.actors) {
      const body = this.bodies.actor(id);
      if (body === null || actors.has(handle) || !this.rows.slots.some(row => row.handle === handle) || [...actors.values()].includes(body)) throw new Error('Invalid population actor continuation');
      actors.set(handle, body);
    }
    const motions = new Map<number, Motion>();
    for (const motion of saved.moves) {
      const body = value(actors.get(motion.actor), 'restored moving actor'), row = value(this.rows.moves[motion.id - 1], 'restored move');
      if (motions.has(motion.actor) || (motion.target !== 0 && motion.target !== DECISION_PLAYER_HANDLE) || row.kind !== 'stalk') throw new Error('Invalid population move continuation');
      const runner = new ActorMoveRunner(row, body); runner.restore(motion.state); motions.set(motion.actor, { ...motion, runner });
    }
    const before = new Map(this.handles), previousFields = new Map(this.fields);
    this.handles.clear(); for (const [id, body] of actors) this.handles.set(id, body);
    this.fields.clear(); for (const [key, n] of fields) this.fields.set(key, n);
    try { this.host.restore(saved.decision); } catch (error) {
      this.handles.clear(); for (const [id, body] of before) this.handles.set(id, body);
      this.fields.clear(); for (const [key, n] of previousFields) this.fields.set(key, n); throw error;
    }
    this.tick = this.host.snapshot().tick;
    this.channels.clear(); for (const [id, n] of channels) this.channels.set(id, n);
    this.motions.clear(); for (const [id, motion] of motions) this.motions.set(id, motion); this.forced = saved.force; this.elapsed = saved.elapsed; this.effects = [];
  }
  private migrate(input: unknown): unknown {
    if (typeof input !== 'object' || input === null || !('version' in input) || input.version !== 1) return input;
    const mapping = value(this.rows.legacy, 'legacy map'), record = v.record(v.string(), v.unknown());
    const old = v.parse(v.strictObject({ version: v.literal(1), population: record, rng: v.strictObject({ version: v.literal(1),
      state: natural, initial: natural, scrambledFork: v.literal(false) }) }), input);
    if (old.population['version'] !== 2 || old.population['spec'] !== mapping.spec || old.rng.initial !== new Rng(this.rows.seed).fork(this.rows.step).snapshot().initial
      || old.rng.state > 0xffffffff) throw new Error('Incompatible legacy population');
    const initial = this.host.snapshot(), binding = initial.bindings[0]; if (binding === undefined) throw new Error('Missing population binding');
    const slots = { ...binding.slots }, actors: [number, string][] = [];
    slots[mapping.acc] = v.parse(finite, old.population['acc']); slots[mapping.rng] = old.rng.state;
    for (const group of mapping.groups) {
      const entries = v.parse(v.array(record), old.population[group.key]);
      if (entries.length > group.slots.length) throw new Error('Legacy population exceeds slots');
      slots[group.active] = (1 << entries.length) - 1;
      for (const [index, entry] of entries.entries()) {
        const slot = value(this.rows.slots.find(row => row.id === group.slots[index]), 'legacy slot'), id = v.parse(v.string(), entry['id']);
        const body = this.bodies.actor(id);
        if (body === null || !this.rows.species.some(row => row.kind === body.kind && row.variant === body.variant)) throw new Error('Incompatible legacy actor');
        actors.push([slot.handle, id]);
        slots[value(group.values[index], 'legacy state')] = group.type === 'bool' ? v.parse(v.boolean(), entry[group.value]) : v.parse(finite, entry[group.value]);
      }
    }
    // Active group masks are mapped as named slots; no shard names or wave thresholds live in the save owner.
    return { version: 2, contract: this.contract, decision: { ...initial, bindings: [{ ...binding, slots, pending: [] }] }, actors,
      fields: [], channels: [[this.rows.channels.indexOf(mapping.countChannel) + 1, actors.length]], force: 0, elapsed: 0, moves: [] };
  }
}

/** Built-in native adapter: row ids resolve the already installed roster; its actor IDs, draw order and save owner stay authoritative. */
export function installNativeSpawnScript(host: SimHost, day: Pick<DayCycleClock, 'night'>, input: unknown): SpawnScript {
  const rows = parseSpawnScript(input), runner = SpawnScript.native(host, rows);
  // A quiet re-save preserves the validated input wire until the first simulation step.
  let restored: SimValue | undefined;
  host.onStep(rows.step, dt => {
    restored = undefined;
    runner.advance(dt, host.player.position, day.night, rows.maximum, rows.flags.filter(flag => host.flags.has(flag)));
    for (const flag of rows.flags) if (runner.hasFlag(flag) !== host.flags.has(flag)) host.flags.set(flag, runner.hasFlag(flag));
    runner.drainEffects();
  }, { snapshot: () => restored ?? runner.snapshot(), restore: saved => { runner.restore(saved); restored = structuredClone(saved); } });
  return runner;
}

/** Resolve a spawn-owned catalogue row and its exact admitted module bytes before installing the synchronous owner. */
export async function readSpawnScript(product: ShardProduct, step: string): Promise<SpawnScriptRows> {
  const rows = v.parse(SpawnScriptsSchema, product.section('actors/spawn-scripts'));
  const row = value(rows.find(item => item.step === step), 'catalogue step');
  const descriptor = value(outputDescriptor(product.shardfile), 'admitted product');
  const file = value(descriptor.index.files.find(item => item.kind === 'wasm' && item.path === row.script.module), 'catalogue module');
  const bytes = await product.file(value(file.name, 'named catalogue module'));
  return { ...row, bytes: btoa(String.fromCodePoint(...bytes)) };
}
