import { StalkerBrain, type PouncerPorts, type HowlerPorts } from '@wildshard/engine/ai/stalker';
import { DiverBrain, type WindDiverPorts, type WindDiverSpec } from '@wildshard/engine/ai/diver';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import type { SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import type { EliteRule } from '@wildshard/game/Elite';

export function argymaqDefinition(horse: SpeciesDef, base: VariantDef): SpeciesDef {
  return { ...horse, kind: ecology.argymaq, label: 'Argymaq', variants: [{ ...base, id: 'stallion', label: 'Argymaq the Unbroken', weight: 1, rarity: 'legendary', scale: [1.3, 1.3], hp: 750, traits: { ...base.traits, mane: 2.2, scar: 1 } }] };
}
export function eliteRuleHolds(rule: EliteRule, phase: string, storm: boolean): boolean {
  return rule === 'always' ? true : rule === 'storm' ? storm : rule === 'night' ? phase === 'night' : phase === 'dusk' || phase === 'night';
}
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
export class NativePouncerKeeper<A extends AnimalSim> extends NativeStalkerKeeper<A> {
  readonly think = this.policy.decidePouncer.bind(this.policy);
  constructor(ports: PouncerPorts<A>) { super(new StalkerBrain<A>({ pattern: 'pouncer', spec: ecology.profiles.aqbars.spec, ports })); }
}
export class NativeHowlerKeeper<A extends AnimalSim> extends NativeStalkerKeeper<A> {
  readonly think = this.policy.decideHowler.bind(this.policy);
  constructor(ports: HowlerPorts<A>) { super(new StalkerBrain<A>({ pattern: 'howler', spec: ecology.profiles.kokbori.spec, ports })); }
  enterPhase2(a: A | null): void { this.policy.enterPhase2(a); }
}

/** Counted binding of the shared flight policy; page effects remain with its owner. */
export class NativeWindKeeper<A extends AnimalSim> {
  private readonly policy;
  readonly think; readonly tick;
  constructor(ports: WindDiverPorts<A>, spec: WindDiverSpec) {
    this.policy = new DiverBrain<A>(null, { pattern: 'wind', spec, ports });
    this.think = this.policy.decideWind.bind(this.policy); this.tick = this.policy.advanceWind.bind(this.policy);
  }
  reset(): void { this.policy.resetWind(); }
  disposeTell(): void { this.policy.disposeWindTell(); }
  spawned(a: A): void { this.policy.spawnWind(a); }
  damage(a: A, point: A['position']): number { return this.policy.windDamage(a, point); }
}
