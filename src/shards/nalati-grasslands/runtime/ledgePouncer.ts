import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { StalkerBrain, type PouncerSpec as SharedSpec, type PouncerPorts as SharedPorts, type PouncerContext as SharedContext, type PouncerLedge as SharedLedge, readPouncerSpec as readSpec } from '@wildshard/engine/ai/stalker';

/** Existing declared native ledge alias for the parametric pounce preset. */
export type PouncerLedge = SharedLedge;
/** Existing finite pounce/swipe tuning alias. */
export type PouncerSpec = SharedSpec;
/** Existing manager-cadence path-query alias. */
export type PouncerContext<A> = SharedContext<A>;
/** Existing native ledge/contact/environment and event-port alias. */
export type PouncerPorts<A> = SharedPorts<A>;
/** Validate through the one defining stalker schema before any body or callback mutation. */
export function readPouncerSpec(value: unknown): PouncerSpec { return readSpec(value); }

/** Existing native constructor and continuation, selecting the pouncer pattern of the shared stalker. */
export class LedgePouncerBrain<A extends AnimalSim> {
  private readonly policy: StalkerBrain<A>;
  constructor(spec: PouncerSpec, ports: PouncerPorts<A>) { this.policy = new StalkerBrain({ pattern: 'pouncer', spec, ports }); }
  /** Native stalking/tell/leap phase. */
  get state(): string { return this.policy.state; }
  /** Preserve the original deferred-spawn clock and pose reset. */
  spawned(): void { this.policy.spawned(); }
  /** Leash home and clear only native transient pose/tell fields. */
  reset(a: A | null): void { this.policy.reset(a); }
  /** Hide entered presentation without losing the controller continuation. */
  disposeTell(): void { this.policy.disposeTell(); }
  /** Preserve the native manager/path query API. */
  think(a: A, c: PouncerContext<A>): void { this.policy.decidePouncer(a, c); }
  /** Deliver native contacts once on the existing attack clock. */
  act(a: A): void { this.policy.act(a); }
  /** Keep engagement, leash and presentation callbacks on their original frame clock. */
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void { this.policy.advance(a, dt, t, engaged, leashing); }
  /** Original authoritative contact multiplier. */
  damage(a: A, p: Vector3): number { return this.policy.damage(a, p); }
  /** Exact typed native continuation, preserving field shape and order. */
  snapshot(): ReturnType<StalkerBrain<A>['pouncerSnapshot']> { return this.policy.pouncerSnapshot(); }
  /** Atomic admission with no gameplay replay. */
  restore(value: unknown): void { this.policy.restore(value); }
}
