import type { Vector3 } from 'three';
import type { Events } from '../events/events';
import type { Scope } from '../app/scope';
import type { Actor, CombatTag, DamageRequest, DeathCause, HealthAttributes } from './pipeline';

export interface PlayerHealthPorts {
  now: () => number; dodging: () => boolean; dodgeGuard: () => boolean;
  position: () => Vector3;
}
/** Health is level-owned. A fall deliberately leaves the six-second regeneration clock unchanged. */
export class PlayerHealth implements Actor {
  readonly id = 'actor.player';
  readonly tags = ['actor.player'] as const;
  effectTags: readonly CombatTag[] = [];
  readonly attributes: HealthAttributes = { health: 100, maxHealth: 100, incomingCap: Infinity };
  lastHurt = 0;
  cause: DeathCause | undefined;
  private lifecycle: { fading: () => boolean; updateFade: (dt: number) => void; died: (cause: DeathCause | undefined, checkpoint: boolean) => void } | null = null;
  bindLifecycle(ports: NonNullable<PlayerHealth['lifecycle']>): void { this.lifecycle = ports; }
  private readonly events: Events;
  private readonly ports: PlayerHealthPorts;
  constructor(events: Events, ports: PlayerHealthPorts) { this.events = events; this.ports = ports; }
  get alive(): boolean { return this.attributes.health > 0; }
  get state(): readonly CombatTag[] {
    return [...this.effectTags, ...(this.lifecycle?.fading() === true ? ['state.death-fade' as const] : []),
      ...(this.ports.dodging() ? ['state.dodging' as const] : []), ...(this.ports.dodgeGuard() ? ['guard.dodge' as const] : [])];
  }
  setMaxHealth(max: number): void {
    const was = this.attributes.maxHealth;
    this.attributes.maxHealth = max;
    this.attributes.health = Math.max(0, Math.min(max, this.attributes.health + Math.max(0, max - was)));
  }
  applyDamage(req: DamageRequest): boolean {
    this.attributes.health = Math.max(0, this.attributes.health - req.amount);
    const fall = req.sourceTags.includes('env.fall');
    if (!fall) { this.lastHurt = this.ports.now(); this.cause = req.cause; }
    else if (this.attributes.health <= 0) this.cause = undefined;
    return this.attributes.health <= 0;
  }
  update(dt: number): void {
    const a = this.attributes;
    if (a.health < a.maxHealth && this.ports.now() - this.lastHurt > 6000) a.health = Math.min(a.maxHealth, a.health + dt * 4);
    this.lifecycle?.updateFade(dt);
    if (this.lifecycle?.fading() === true) a.health = a.maxHealth;
    if (a.health > 0) return;
    const cause = this.cause;
    a.health = a.maxHealth;
    this.events.emit('player.died', cause === undefined ? {} : { cause });
    const answer: unknown = this.events.ask('death.checkpoint', cause === undefined ? {} : { cause });
    const checkpoint = answer === true;
    this.lifecycle?.died(cause, checkpoint);
    this.cause = undefined;
    this.events.emit('player.respawned', { at: this.ports.position().clone(), checkpoint });
  }
  /** Encounter answerers preserve the old short-circuit: an earlier accepted checkpoint wins. */
  checkpoint(scope: Scope, answer: () => boolean, active: () => boolean = () => true): void {
    this.events.answer('death.checkpoint', (value) => value === true || (active() && answer()), scope);
  }
}
