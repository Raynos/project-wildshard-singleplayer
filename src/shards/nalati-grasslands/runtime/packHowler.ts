import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { StalkerBrain, type HowlerSpec as SharedSpec, type HowlerPorts as SharedPorts, type HowlerPack as SharedPack, readHowlerSpec as readSpec } from '@wildshard/engine/ai/stalker';
import type { PouncerContext } from './ledgePouncer';

/** Existing real-pack authority alias for the parametric howl preset. */
export type HowlerPack<A extends AnimalSim> = SharedPack<A>;
/** Existing finite tuning alias for the howl preset. */
export type HowlerSpec = SharedSpec;
/** Existing native pack/player/environment and event-port alias. */
export type HowlerPorts<A extends AnimalSim> = SharedPorts<A>;
/** Validate through the one defining stalker schema before any body or callback mutation. */
export function readHowlerSpec(value: unknown): HowlerSpec { return readSpec(value); }

/** Existing native constructor and continuation, selecting the howler pattern of the shared stalker. */
export class PackHowlerBrain<A extends AnimalSim> {
  private readonly policy: StalkerBrain<A>;
  constructor(spec: HowlerSpec, ports: HowlerPorts<A>) { this.policy = new StalkerBrain({ pattern: 'howler', spec, ports }); }
  /** Preserve the original deferred-spawn clock and pose reset. */
  spawned(a: A): void { this.policy.spawned(a); }
  /** Leash home and clear only native transient pose/tell fields. */
  reset(a: A | null): void { this.policy.reset(a); }
  /** Hide entered presentation without losing the controller continuation. */
  disposeTell(): void { this.policy.disposeTell(); }
  /** Preserve the native manager/path query API. */
  think(a: A, c: PouncerContext<A>): void { this.policy.decideHowler(a, c); }
  /** Deliver native contacts once on the existing attack clock. */
  act(a: A): void { this.policy.act(a); }
  /** Keep engagement, leash and presentation callbacks on their original frame clock. */
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void { this.policy.advance(a, dt, t, engaged, leashing); }
  /** Original authoritative contact multiplier. */
  damage(a: A, p: Vector3): number { return this.policy.damage(a, p); }
  /** Regroup the same already-owned pack, without a second phase machine. */
  enterPhase2(a: A | null): void { this.policy.enterPhase2(a); }
  /** Exact typed native continuation, preserving field shape and order. */
  snapshot(): ReturnType<StalkerBrain<A>['howlerSnapshot']> { return this.policy.howlerSnapshot(); }
  /** Atomic admission with no gameplay replay. */
  restore(value: unknown): void { this.policy.restore(value); }
}
