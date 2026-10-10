import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { speciesBrains, type SpeciesStooper, type SpeciesStooperPorts } from '@wildshard/sdk/speciesBrains';
import { NALATI_ELITE_SPECIES, QYRAN_GROUNDED } from '../data/eliteBrains';

/** Existing native body, wind/altitude/contact and entered cue ports. */
export interface QyranPorts<A extends AnimalSim> extends Omit<SpeciesStooperPorts<A>, 'grounded' | 'cry'> {
  readonly feed: (text: string) => void; readonly sound: (cue: 'eagle_cry', at: Vector3) => void;
}
/** Thin trusted binding of the declared wind-stooper row, used by the page and renderer-free host. */
export class QyranKeeper<A extends AnimalSim> {
  private readonly policy: SpeciesStooper<A>;
  /** Native manager cadence bound once without per-frame allocation. */
  readonly think: SpeciesStooper<A>['think'];
  /** Exact encounter frame law over the authoritative body/altitude state. */
  readonly tick: SpeciesStooper<A>['tick'];
  constructor(ports: QyranPorts<A>) {
    this.policy = speciesBrains(NALATI_ELITE_SPECIES, []).stooper('eagle', { ...ports,
      grounded: () => { ports.feed(QYRAN_GROUNDED); }, cry: at => { ports.sound('eagle_cry', at); } });
    this.think = this.policy.think.bind(this.policy); this.tick = this.policy.tick.bind(this.policy);
  }
  /** Return to climb with the same retained clocks. */
  reset(): void { this.policy.reset(); }
  /** Detach transient entered tells without dropping the continuation. */
  disposeTell(): void { this.policy.disposeTell(); }
  /** Keep real deferred body identity and the original initial cooldown. */
  spawned(actor: A): void { this.policy.spawned(actor); }
  /** Grounded weak point through the real head query. */
  damage(actor: A, point: Vector3): number { return this.policy.damage(actor, point); }
  /** Complete original keeper wire; no draws or events. */
  snapshot(): ReturnType<SpeciesStooper<A>['snapshot']> { return this.policy.snapshot(); }
  /** Strict complete validation before any mutation. */
  restore(input: unknown): void { this.policy.restore(input); }
}
