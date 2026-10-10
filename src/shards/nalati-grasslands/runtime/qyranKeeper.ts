import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { WindStooperBrain, type WindStooperPorts } from './windStooper';
import { QYRAN_BRAIN, QYRAN_GROUNDED } from './qyranData';

/** Existing native body, wind/altitude/contact and entered cue ports. */
export interface QyranPorts<A extends AnimalSim> extends Omit<WindStooperPorts<A>, 'grounded' | 'cry'> {
  readonly feed: (text: string) => void; readonly sound: (cue: 'eagle_cry', at: Vector3) => void;
}
/** Trusted binding of Nalati's own wind-stooper tuning, used by the page and renderer-free host. */
export class QyranKeeper<A extends AnimalSim> {
  private readonly policy: WindStooperBrain<A>;
  /** Native manager cadence bound once without per-frame allocation. */
  readonly think: WindStooperBrain<A>['think'];
  /** Exact encounter frame law over the authoritative body/altitude state. */
  readonly tick: WindStooperBrain<A>['tick'];
  constructor(ports: QyranPorts<A>) {
    this.policy = new WindStooperBrain(QYRAN_BRAIN.data, { ...ports,
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
  snapshot(): ReturnType<WindStooperBrain<A>['snapshot']> { return this.policy.snapshot(); }
  /** Strict complete validation before any mutation. */
  restore(input: unknown): void { this.policy.restore(input); }
}
