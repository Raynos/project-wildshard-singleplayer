import * as v from 'valibot';
import { NativeReturnRowsSchema, type RespawnEntry } from '@wildshard/format/populationRespawn';
import type { SimHost } from '@wildshard/engine/sim';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { StalkerBrain } from '@wildshard/engine/ai/stalker';
import { RespawnQueue } from './respawn';
import { ReturnProgram } from './returnProgram';

const finite = v.pipe(v.number(), v.finite());
const savedEntry = v.strictObject({ kind: v.string(), variant: v.string(), herd: finite,
  x: finite, z: finite, due: finite, night: v.boolean(), id: v.string() });
interface ReturnBody { readonly id: string; readonly kind: string; readonly variant: string; readonly herd: number; readonly actor: HuntBody | null }
type ReturnEntry = v.InferOutput<typeof savedEntry>;

/** Built-in roster child. Only createNativeCreatureRoster constructs it with
 * its actual body map and hunt; shard callers supply declaration rows only.
 * Queue ownership is independent of policy binding and body materialization. */
export class NativeReturns {
  private readonly rows;
  private readonly queue;
  private readonly predecessors = new Map<RespawnEntry, string>();
  private readonly idle: RespawnEntry[] = [];
  private now = 0;
  private check = 0;
  private readonly host: SimHost;
  constructor(host: SimHost, bodies: ReadonlyMap<string, ReturnBody>, hunt: StalkerBrain<HuntBody>, input: unknown) {
    this.host = host;
    this.rows = v.parse(NativeReturnRowsSchema, input);
    this.queue = new RespawnQueue(this.rows.rules, this.rows.outOfSight,
      { order: 'reverse', limit: this.rows.limit, result: 'reuse' }, ReturnProgram.native(host, this.rows.program));
    host.events.on('actor.died', ({ actor }) => {
      const body = [...bodies.values()].find(row => row.actor?.combatActor() === actor), native = body?.actor;
      if (body === undefined || native === null || native === undefined || !this.queue.accepts(body.kind)) return;
      if (this.queue.pending.length >= this.rows.limit) throw new Error('Native return queue exceeds its bound');
      const herd = hunt.herds[body.herd];
      const entry = this.queue.add(body.kind, body.variant, body.herd, herd?.cx ?? native.position.x,
        herd?.cz ?? native.position.z, this.now, host.rng.stream('spawn').next());
      if (entry !== null) this.predecessors.set(entry, body.id);
    }, host.scope);
  }
  /** At most one bounded queue scan per declared interval; retry entries keep
   * their predecessor and consume only the program's borrowed spawn draws. */
  take(dt: number): readonly RespawnEntry[] {
    this.now += dt;
    if (this.now - this.check < this.rows.interval) return this.idle;
    this.check = this.now;
    const player = this.host.player.position;
    return this.queue.take(this.now, player.x, player.z, this.host.dayClock?.night ?? 0);
  }
  /** Resolve one due entry at the caller's spawn boundary, preserving random
   * draw interleaving between placement and each body's materialization. */
  place(entry: RespawnEntry): ReturnEntry | null {
    const id = this.predecessors.get(entry);
    if (id === undefined) throw new Error('Foreign native return entry');
    const at = this.queue.place(entry, this.now, this.rows.water, this.rows.fixed.includes(entry.kind), this.host.rng.stream('spawn'));
    if (at === null) return null;
    this.predecessors.delete(entry);
    return { ...entry, ...at, variant: entry.variant ?? '', id };
  }
  /** The established native ecology wire, including its exact death order. */
  snapshot(): { now: number; check: number; pending: ReturnEntry[] } {
    return { now: this.now, check: this.check, pending: this.queue.pending.map(entry => ({
      ...entry, variant: entry.variant ?? '', id: this.predecessors.get(entry) ?? '',
    })) };
  }
  /** Quiet restore neither calls the guest nor draws or spawns a body. */
  restore(value: unknown): void {
    const state = v.parse(v.strictObject({ now: finite, check: finite,
      pending: v.pipe(v.array(savedEntry), v.maxLength(this.rows.limit)) }), value);
    this.now = state.now; this.check = state.check; this.queue.pending.length = 0; this.predecessors.clear();
    for (const { id, ...entry } of state.pending) { this.queue.pending.push(entry); this.predecessors.set(entry, id); }
  }
}
