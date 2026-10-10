import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { speciesBrains, type SpeciesPouncer, type SpeciesPouncerPorts, type SpeciesPouncerContext,
  type SpeciesPouncerLedge } from '@wildshard/sdk/speciesBrains';
import { AQBARS_OPEN, NALATI_ELITE_SPECIES } from '../data/eliteBrains';

/** Solid Crags ledges observed by the native world. */
export type AqbarsLedge = SpeciesPouncerLedge;
/** Existing manager decision clock and authoritative path query. */
export type AqbarsContext<A> = SpeciesPouncerContext<A>;
/** Existing encounter and view ports; the declared platform policy owns all decisions and clocks. */
export interface AqbarsPorts<A> extends Omit<SpeciesPouncerPorts<A>, 'opened' | 'growl'> {
  readonly feed: (text: string) => void;
  readonly sound: (name: 'leopard_growl', at: Vector3) => void;
}
/** Thin trusted adapter of the declared Aqbars species brain; spawn identity and entered presentation remain runtime-owned. */
export class AqbarsKeeper<A extends AnimalSim> {
  private readonly policy: SpeciesPouncer<A>;
  /** Native manager decision cadence, bound once rather than allocating in a frame. */
  readonly think: SpeciesPouncer<A>['think'];
  /** Exact encounter/frame order, including the real ballistic body motion. */
  readonly tick: SpeciesPouncer<A>['tick'];
  constructor(ports: AqbarsPorts<A>) {
    const brains = speciesBrains(NALATI_ELITE_SPECIES, []);
    this.policy = brains.pouncer('leopard', { ...ports,
      opened: () => { ports.feed(AQBARS_OPEN); }, growl: at => { ports.sound('leopard_growl', at); } });
    this.think = this.policy.think.bind(this.policy);
    this.tick = this.policy.tick.bind(this.policy);
  }
  /** Current declared decision phase. */
  get state(): string { return this.policy.state; }
  /** Preserve the page's deferred spawn/reset timing. */
  spawned(): void { this.policy.spawned(); }
  /** Return home and cancel the entered tell. */
  reset(a: A | null): void { this.policy.reset(a); }
  /** Cancel only presentation on leave. */
  disposeTell(): void { this.policy.disposeTell(); }
  /** Weak-point multiplier from the actual contact point. */
  damage(a: A, point: Vector3): number { return this.policy.damage(a, point); }
  /** Native body attack-phase contacts. */
  act(a: A): void { this.policy.act(a); }
  /** Preserve the existing keeper continuation wire. */
  snapshot(): ReturnType<SpeciesPouncer<A>['snapshot']> { return this.policy.snapshot(); }
  /** Complete validation precedes mutation. */
  restore(input: unknown): void { this.policy.restore(input); }
}
