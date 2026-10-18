import { StalkerBrain, type PouncerPorts, type HowlerPorts } from '@wildshard/engine/ai/stalker';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import type { SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import type { EliteRule } from '@wildshard/game/Elite';

/** His species row from the horse's (`base`: its stallion): one legendary variant 'stallion', x1.3, 750 hp. */
export function argymaqDefinition(horse: SpeciesDef, base: VariantDef): SpeciesDef {
  return { ...horse, kind: ecology.argymaq, label: 'Argymaq', variants: [{ ...base, id: 'stallion', label: 'Argymaq the Unbroken', weight: 1, rarity: 'legendary', scale: [1.3, 1.3], hp: 750, traits: { ...base.traits, mane: 2.2, scar: 1 } }] };
}

/** The page's spawn rule (combat/elites.ts NalatiElites `condition`) over the day phase and the storm. */
export function eliteRuleHolds(rule: EliteRule, phase: string, storm: boolean): boolean {
  return rule === 'always' ? true : rule === 'storm' ? storm : rule === 'night' ? phase === 'night' : phase === 'dusk' || phase === 'night';
}

/** Counted method-name adapter; policy and save envelopes remain in the existing core. */
class NativeStalkerKeeper<A extends AnimalSim> {
  constructor(protected readonly policy: StalkerBrain<A>) {}
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void { this.policy.advance(a, dt, t, engaged, leashing); }
  act(a: A): void { this.policy.act(a); }
  damage(a: A, point: A['position']): number { return this.policy.damage(a, point); }
  spawned(a?: A): void { this.policy.spawned(a); }
  reset(a: A | null): void { this.policy.reset(a); }
  disposeTell(): void { this.policy.disposeTell(); }
  snapshot(): ReturnType<StalkerBrain<A>['snapshot']> { return this.policy.snapshot(); }
  restore(saved: unknown): void { this.policy.restore(saved); }
}
/** The headless assembly's pouncer constructor, without a second policy or save owner. */
export class NativePouncerKeeper<A extends AnimalSim> extends NativeStalkerKeeper<A> {
  readonly think = this.policy.decidePouncer.bind(this.policy);
  constructor(ports: PouncerPorts<A>) { super(new StalkerBrain<A>({ pattern: 'pouncer', spec: ecology.profiles.aqbars.spec, ports })); }
}
/** The corresponding pack-howler constructor. */
export class NativeHowlerKeeper<A extends AnimalSim> extends NativeStalkerKeeper<A> {
  readonly think = this.policy.decideHowler.bind(this.policy);
  constructor(ports: HowlerPorts<A>) { super(new StalkerBrain<A>({ pattern: 'howler', spec: ecology.profiles.kokbori.spec, ports })); }
  enterPhase2(a: A | null): void { this.policy.enterPhase2(a); }
}
