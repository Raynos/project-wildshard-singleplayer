import { Vector3 } from 'three';
import type { Actor, CombatTag, DamageDealt, DamageRequest } from './pipeline';

const contactDelta = new Vector3();

/** Distance inside a numeric cone or chest lane, or null; target ordering remains with the native owner. */
export function weaponContactDistance(from: Vector3, dir: Vector3, at: Vector3, kind: 'cone' | 'lane',
  reach: number, size: number, height = 0, allowance = 0): number | null {
  const delta = contactDelta.copy(at).sub(from);
  if (kind === 'cone') {
    const length = delta.length();
    if (length > reach) return null;
    if (length < 1e-3) return length;
    return delta.dot(dir) / (length * Math.max(dir.length(), 1e-6)) >= Math.cos(size) ? length : null;
  }
  delta.y += height;
  const forward = delta.dot(dir);
  if (forward < 0 || forward > reach + allowance) return null;
  return delta.addScaledVector(dir, -forward).length() > size + allowance ? null : forward;
}

/** The actual body's reaction ports, lent by the native owner. */
export interface WeaponContactTarget {
  readonly actor: Actor | null;
  readonly impulse?: (velocity: Vector3) => void;
  readonly stagger?: (dir: Vector3, strength: number) => void;
}
/** Numeric ordered reactions; health predicates read the live actor after an accepted contact. */
export type WeaponContactReaction = { readonly when: 'before' | 'survived'; readonly kind: 'impulse';
  readonly direction: 'radial-away' | 'aim-backward'; readonly speed: number; readonly lift: number; readonly maxHealth?: number }
  | { readonly when: 'before' | 'survived'; readonly kind: 'stagger'; readonly strength: number; readonly aboveHealth?: number };
/** One admitted move's contact fields; vector/tag ownership preserves the existing caller's event lifetime. */
export interface WeaponContactMove {
  readonly source: Actor | 'env'; readonly tags: readonly CombatTag[]; readonly damage: number;
  readonly weaponId: string; readonly moveId: string; readonly copyVectors: boolean; readonly copyTags: boolean;
  readonly reactions: readonly WeaponContactReaction[];
}

/** Renderer-free contact and cooldown host shared by immediate and delayed weapon families. */
export class ContactWeaponHost {
  /** Remaining seconds on the ordinary and independent secondary move lanes. */
  primary = 0; secondary = 0;
  private readonly hit: (request: DamageRequest) => DamageDealt | null;
  constructor(hit: (request: DamageRequest) => DamageDealt | null) { this.hit = hit; }
  /** Claim one lane, preserving refusal while its existing cooldown remains positive. */
  claim(lane: 'primary' | 'secondary', seconds: number): boolean {
    if (this[lane] > 0) return false;
    this[lane] = seconds; return true;
  }
  /** Count both clocks down once in the caller's original phase; never installs a callback. */
  countDown(dt: number): void { this.primary = Math.max(0, this.primary - dt); this.secondary = Math.max(0, this.secondary - dt); }
  /** Execute numeric responses in order, sampling positions and survivor health in their original phase. */
  contact(target: WeaponContactTarget, move: WeaponContactMove, point: Vector3, dir: Vector3, from: Vector3,
    accepted?: (actorId: string, killed: boolean) => void): DamageDealt | null {
    const actor = target.actor;
    if (actor === null) return null;
    for (const reaction of move.reactions) if (reaction.when === 'before') this.react(target, actor, reaction, point, dir, from);
    const result = this.hit({ source: move.source, sourceTags: move.copyTags ? [...move.tags] : move.tags, target: actor,
      amount: move.damage, point: move.copyVectors ? point.clone() : point, dir: move.copyVectors ? dir.clone() : dir,
      from: move.copyVectors ? from.clone() : from, weaponId: move.weaponId, moveId: move.moveId, surface: 'flesh' });
    if (result === null) return null;
    accepted?.(actor.id, result.killed);
    if (!result.killed) for (const reaction of move.reactions) if (reaction.when === 'survived') this.react(target, actor, reaction, point, dir, from);
    return result;
  }
  private react(target: WeaponContactTarget, actor: Actor, reaction: WeaponContactReaction, point: Vector3, dir: Vector3, from: Vector3): void {
    if (reaction.kind === 'impulse') {
      if (reaction.maxHealth !== undefined && actor.attributes.maxHealth > reaction.maxHealth) return;
      const velocity = reaction.direction === 'aim-backward' ? new Vector3(-dir.x, 0, -dir.z) : point.clone().sub(from).setY(0);
      if (reaction.direction === 'radial-away' && velocity.lengthSq() < 1e-4) velocity.set(dir.x, 0, dir.z);
      velocity.normalize().multiplyScalar(reaction.speed).setY(reaction.lift);
      target.impulse?.(velocity);
    } else if (reaction.aboveHealth === undefined || actor.attributes.maxHealth > reaction.aboveHealth) target.stagger?.(dir, reaction.strength);
  }

}

/** A held release clock shared by page weapons and fixed-step native input adapters. */
export class HeldWeaponClock {
  /** Accumulated held seconds and the preceding authoritative hold bit. */
  elapsed = 0; held = false;
  /** Advance once, invoking release before clearing elapsed time; disabled holds cancel without releasing. */
  step(dt: number, enabled: boolean, held: boolean, release: () => void): void {
    if (!enabled) this.reset();
    else if (held) this.elapsed += dt;
    else if (this.held) { release(); this.elapsed = 0; }
    this.held = enabled && held;
  }
  /** Cancel an owned hold without producing a move or callback. */
  reset(): void { this.elapsed = 0; this.held = false; }
}
