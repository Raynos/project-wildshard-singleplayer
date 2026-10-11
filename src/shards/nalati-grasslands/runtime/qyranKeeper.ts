import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { DiverBrain, type WindDiverPorts } from '@wildshard/engine/ai/diver';
import { QYRAN_PROFILE, QYRAN_GROUNDED } from '../data/qyranProfile';

/** Existing native body, wind/altitude/contact and entered cue ports. */
export interface QyranPorts<A extends AnimalSim> extends Omit<WindDiverPorts<A>, 'grounded' | 'cry'> {
  readonly feed: (text: string) => void; readonly sound: (cue: 'eagle_cry', at: Vector3) => void;
}
/** Trusted binding of Nalati's own wind-stooper tuning, used by the page and renderer-free host. */
export class QyranKeeper<A extends AnimalSim> {
  private readonly policy: DiverBrain<A>;
  /** Native manager cadence bound once without per-frame allocation. */
  readonly think: DiverBrain<A>['decideWind'];
  /** Exact encounter frame law over the authoritative body/altitude state. */
  readonly tick: DiverBrain<A>['advanceWind'];
  constructor(ports: QyranPorts<A>) {
    this.policy = new DiverBrain<A>(null, { ...QYRAN_PROFILE, ports: { ...ports,
      grounded: () => { ports.feed(QYRAN_GROUNDED); }, cry: at => { ports.sound('eagle_cry', at); } } });
    this.think = this.policy.decideWind.bind(this.policy); this.tick = this.policy.advanceWind.bind(this.policy);
  }
  /** Return to climb with the same retained clocks. */
  reset(): void { this.policy.resetWind(); }
  /** Detach transient entered tells without dropping the continuation. */
  disposeTell(): void { this.policy.disposeWindTell(); }
  /** Keep real deferred body identity and the original initial cooldown. */
  spawned(actor: A): void { this.policy.spawnWind(actor); }
  /** Grounded weak point through the real head query. */
  damage(actor: A, point: Vector3): number { return this.policy.windDamage(actor, point); }
  /** Complete original keeper wire; no draws or events. */
  snapshot(): ReturnType<DiverBrain<A>['windSnapshot']> { return this.policy.windSnapshot(); }
  /** Strict complete validation before any mutation. */
  restore(input: unknown): void { this.policy.restore(input); }
}
