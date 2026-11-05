// P1-E3.2 (J33, J47, E5-REPLICATION §4.3): what the server settled, as events for the wire. The pipeline's own `damage.dealt`
// and `actor.died` are the only source, so a hit reaches a client exactly when it reached the sim.
import type { SimHost } from '../sim';
import type { DamageRequest } from '../combat/pipeline';

/** A settled hit or death in world terms, before the room turns ids into a client's handles. */
export type CombatEvent =
  | { readonly kind: 'hit'; readonly tick: number; readonly target: string; readonly amount: number; readonly at: readonly [number, number, number];
    readonly head: boolean; readonly killed: boolean; readonly owned: boolean }
  | { readonly kind: 'died'; readonly tick: number; readonly id: string; readonly by: string | null;
    readonly dir: readonly [number, number, number]; readonly impulse: number };

const ownedBy = (req: DamageRequest): boolean => req.sourceTags.includes('actor.player');

/** Listens on a host for its lifetime and hands over each tick's settled combat. */
export class CombatWire {
  private rows: CombatEvent[] = [];
  constructor(host: Pick<SimHost, 'events' | 'scope' | 'state' | 'player'>) {
    host.events.on('damage.dealt', ({ req, dealt, killed }) => {
      const { point: p } = req;
      this.rows.push({ kind: 'hit', tick: host.state.tick, target: req.target.id, amount: dealt, at: [p.x, p.y, p.z], head: req.headshot ?? false, killed, owned: ownedBy(req) });
    }, host.scope);
    host.events.on('actor.died', ({ actor, req }) => {
      const by = req.source !== 'env' ? req.source.id : ownedBy(req) ? host.player.id : null, { dir: d } = req;
      // The ragdoll's throw grows with the blow, as AnimalView.startRagdoll's does: each client simulates its own (J33).
      this.rows.push({ kind: 'died', tick: host.state.tick, id: actor.id, by, dir: [d.x, d.y, d.z], impulse: req.amount });
    }, host.scope);
  }
  /** Everything settled since the last call, in the order it happened. */
  drain(): readonly CombatEvent[] {
    if (this.rows.length === 0) return [];
    const rows = this.rows; this.rows = [];
    return rows;
  }
}
