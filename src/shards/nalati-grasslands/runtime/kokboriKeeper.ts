import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { speciesBrains, type SpeciesHowler, type SpeciesHowlerPorts, type SpeciesPouncerContext } from '@wildshard/sdk/speciesBrains';
import { KOKBORI_CUES, NALATI_ELITE_SPECIES } from '../data/eliteBrains';

/** The actual pack remains owned and snapshotted by its group host. */
export type KokboriPack<A extends AnimalSim> = Pick<PackBrain<A>, 'homeX' | 'homeZ' | 'phase' | 'awareness' | 'scare'>;
/** Existing native encounter and entered cue ports; all decision and frame law belongs to the declared brain. */
export interface KokboriPorts<A extends AnimalSim> extends Omit<SpeciesHowlerPorts<A>, 'regrouped' | 'interrupted' | 'closed' | 'howl'> {
  readonly feed: (text: string) => void; readonly sound: (cue: 'wolf_howl', at: Vector3) => void;
}
/** Thin trusted binding of Kokbori's declared pack-howler row, used by both the page and the native host. */
export class KokboriKeeper<A extends AnimalSim> {
  private readonly policy: SpeciesHowler<A>;
  /** Manager decision cadence bound once, with no per-frame allocation. */
  readonly think: (actor: A, context: SpeciesPouncerContext<A>) => void;
  /** Exact encounter frame order over the real pack. */
  readonly tick: SpeciesHowler<A>['tick'];
  constructor(ports: KokboriPorts<A>) {
    this.policy = speciesBrains(NALATI_ELITE_SPECIES, []).howler('kokbori', { ...ports,
      regrouped: () => { ports.feed(KOKBORI_CUES.regrouped); }, interrupted: () => { ports.feed(KOKBORI_CUES.interrupted); },
      closed: () => { ports.feed(KOKBORI_CUES.closed); }, howl: at => { ports.sound('wolf_howl', at); } });
    this.think = this.policy.think.bind(this.policy); this.tick = this.policy.tick.bind(this.policy);
  }
  /** Preserve deferred spawn order and the original initial howl clock. */
  spawned(actor: A): void { this.policy.spawned(actor); }
  /** Leash home while retaining the original clocks. */
  reset(actor: A | null): void { this.policy.reset(actor); }
  /** Cancel entered tells while retaining the controller. */
  disposeTell(): void { this.policy.disposeTell(); }
  /** Regroup the real pack and enter the second phase. */
  enterPhase2(actor: A | null): void { this.policy.enterPhase2(actor); }
  /** Hidden ranged weak point from the actual player and grass queries. */
  damage(actor: A, point: Vector3): number { return this.policy.damage(actor, point); }
  /** Deliver the committed body bite once at its actual attack phase. */
  act(actor: A): void { this.policy.act(actor); }
  /** Keep the original keeper continuation wire. */
  snapshot(): ReturnType<SpeciesHowler<A>['snapshot']> { return this.policy.snapshot(); }
  /** Strict complete validation before mutation. */
  restore(input: unknown): void { this.policy.restore(input); }
}
