import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import { huntMemoryCodec } from '@wildshard/engine/ai/huntPattern';
import { StalkerBrain } from '@wildshard/engine/ai/stalker';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';

/** Existing native envelope fields; adapters retain their historical wire names. */
export interface NativeHuntContinuation {
  readonly clock: number; readonly rng: ReturnType<Rng['snapshot']>;
  readonly noise: { readonly seen: boolean; readonly speed: number; readonly prev: readonly [number, number, number] };
  readonly sight: readonly (boolean | null | undefined)[]; readonly memories: readonly unknown[];
  readonly herds: readonly (readonly [number, number])[];
}
/** Detached scalar/vector state; never a borrowed body, memory or controller. */
export interface NativeHuntSnapshot {
  clock: number; rng: { [K in keyof ReturnType<Rng['snapshot']>]: ReturnType<Rng['snapshot']>[K] };
  noise: { seen: boolean; speed: number; prev: [number, number, number] };
  sight: (boolean | null)[]; memories: (ReturnType<typeof huntMemoryCodec.save> | null)[];
  herds: [number, number][];
}
/** Immutable native capacity and historical memory field selection. */
export interface NativeManagerRows {
  readonly limit: number; readonly sightSlots: number; readonly initialSight: boolean | null;
  readonly memoryFields?: readonly string[];
}
const huntBody = (actor: AnimalSim): actor is HuntBody => 'hidden' in actor && typeof actor.hidden === 'boolean'
  && 'sampleTerrain' in actor && typeof actor.sampleTerrain === 'function';

/** Native manager state over concrete built-in hunt/stream owners. Inputs are
 * actor ids, plain rows and saved values, never a shard resolver or callback.
 * This installs no independent clock, allocates no actor and draws no entropy.
 * Null roster slots preserve a retired body's historical array position. */
export class NativeManager {
  readonly noise = { seen: false, speed: 0, prev: new Vector3() };
  readonly sight: (boolean | null | undefined)[];
  private clock = 0;
  constructor(private readonly host: SimHost, private readonly hunt: StalkerBrain<HuntBody>, private readonly stream: Rng, private readonly rows: NativeManagerRows) {
    if (!(hunt instanceof StalkerBrain) || !(stream instanceof Rng) || !Number.isSafeInteger(rows.limit) || rows.limit < 1 || rows.limit > 1024
      || !Number.isSafeInteger(rows.sightSlots) || rows.sightSlots < 0 || rows.sightSlots > rows.limit
      || (rows.initialSight !== null && typeof rows.initialSight !== 'boolean')) throw new Error('Invalid native manager owners or capacity');
    this.sight = Array.from({ length: rows.sightSlots }, () => rows.initialSight);
  }
  /** Advance at the original manager phase, with the owner's actual dt. */
  advance(dt: number): void { this.hunt.beginTick(dt); this.clock += dt; }
  /** Resolve every native identity before observing or restoring any state. */
  private roster(ids: readonly (string | null)[], participants: readonly string[]): (HuntBody | null)[] {
    const present = ids.filter((id): id is string => id !== null), names = new Set(present);
    if (ids.length > this.rows.limit || names.size !== present.length || new Set(participants).size !== participants.length
      || participants.some(id => !names.has(id))) throw new Error('Invalid native manager roster');
    return ids.map(id => {
      if (id === null) return null;
      const actor = this.host.entities.get(id);
      if (actor === undefined || !huntBody(actor)) throw new Error('Foreign native manager body');
      return actor;
    });
  }
  /** Capture a detached common payload in the adapter's declared slot order. */
  snapshot(ids: readonly (string | null)[], participants: readonly string[]): NativeHuntSnapshot {
    const bodies = this.roster(ids, participants), participating = new Set(participants);
    return { clock: this.clock, rng: { ...this.stream.snapshot() }, noise: { seen: this.noise.seen, speed: this.noise.speed, prev: this.noise.prev.toArray() },
      sight: this.sight.map(value => value ?? null), memories: bodies.map(actor => {
        const memory = actor === null || !participating.has(actor.entityId) ? undefined : this.hunt.memory(actor);
        return memory === undefined ? null : huntMemoryCodec.save(memory, this.rows.memoryFields);
      }), herds: this.hunt.herds.map(herd => [herd.cx, herd.cz]) };
  }
  /** Quietly restore after the adapter reinstalls its exact native roster. */
  restore(state: NativeHuntContinuation, ids: readonly (string | null)[], participants: readonly string[]): void {
    const bodies = this.roster(ids, participants), participating = new Set(participants);
    if (state.memories.length !== bodies.length || state.sight.length !== this.sight.length || state.herds.length !== this.hunt.herds.length
      || !Number.isFinite(state.clock)) throw new Error('Incompatible native manager continuation');
    this.stream.restore(state.rng); this.hunt.beginTick(state.clock - this.clock); this.clock = state.clock;
    this.noise.seen = state.noise.seen; this.noise.speed = state.noise.speed; this.noise.prev.set(...state.noise.prev);
    state.sight.forEach((seen, i) => { this.sight[i] = seen; });
    state.herds.forEach(([cx, cz], i) => { const herd = this.hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
    bodies.forEach((actor, i) => {
      const memory = actor === null || !participating.has(actor.entityId) ? undefined : this.hunt.memory(actor), saved = state.memories[i];
      if ((saved === null) !== (memory === undefined)) throw new Error('Incompatible native manager memory');
      if (memory !== undefined) huntMemoryCodec.restore(memory, saved, this.rows.memoryFields === undefined);
    });
  }
}
