import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { DiverBrain, readWindDiverSpec, type WindDiverSpec, type WindDiverPorts } from '@wildshard/engine/ai/diver';

/** Existing terrain, wind, altitude, contact and presentation authority for the wind-diver preset. */
export type WindStooperPorts<A extends AnimalSim> = WindDiverPorts<A>;
/** Existing bounded wind orbit, tell, stoop and grounded-punish tuning. */
export type WindStooperSpec = WindDiverSpec;
/** Validate through the one defining wind-diver schema before any native actor mutation. */
export function readWindStooperSpec(value: unknown): WindStooperSpec { return readWindDiverSpec(value); }

/** Existing deferred-spawn constructor and exact native continuation, selecting the shared wind diver. */
export class WindStooperBrain<A extends AnimalSim> {
  private readonly policy: DiverBrain<A>;
  constructor(spec: WindStooperSpec, ports: WindStooperPorts<A>) { this.policy = new DiverBrain<A>(null, { pattern: 'wind', spec, ports }); }
  /** Preserve the native climb reset and retained clocks. */
  reset(): void { this.policy.resetWind(); }
  /** Hide entered tells without changing the retained continuation. */
  disposeTell(): void { this.policy.disposeWindTell(); }
  /** Admit the host's actual deferred body at its original home altitude. */
  spawned(a: A): void { this.policy.spawnWind(a); }
  /** Retain the grounded weak point's authoritative head query. */
  damage(a: A, point: Vector3): number { return this.policy.windDamage(a, point); }
  /** Observe on the original native manager cadence, without taking frame authority. */
  think(a: A, observation: { readonly player: Vector3 }): void { this.policy.decideWind(a, observation); }
  /** Advance the native terrain/wind frame law and callbacks in their original order. */
  tick(a: A | null, dt: number, time: number, engaged: boolean, leashing: boolean): void { this.policy.advanceWind(a, dt, time, engaged, leashing); }
  /** Exact typed native continuation with no extra contract or inspection state. */
  snapshot(): ReturnType<DiverBrain<A>['windSnapshot']> { return this.policy.windSnapshot(); }
  /** Restore atomically without callbacks, RNG draws or a fabricated body. */
  restore(value: unknown): void { this.policy.restore(value); }
}
