import * as v from 'valibot';
import type { Vector3 } from 'three';
import type { Actor, CombatTag, DamageDealt, DamageRequest } from '@wildshard/engine/combat/pipeline';

/**
 * A cone fan's moves, view-free (SHARD-PLATFORM M3; the held weapon is `./coneFan`): the SWING / HEAVY cooldowns and arc
 * slash through the damage pipeline, and the GUST cone's impulse and wind hit. A renderer-free host's adapter runs this
 * module alone (it imports no view); its continuation is `{ cooldown, gustCooldown }`.
 */

/** Anything the fan can strike: a world position and its combat actor, and how it takes the gust's push. */
export interface ConeFanTarget { readonly position: Vector3; readonly actor: Actor | null; impulse?: (velocity: Vector3) => void }
/** What the moves' contacts are lent: the damage pipeline's contact and the live targets, in the combat query's order. */
export interface ConeStrikePorts {
  readonly hit: (req: DamageRequest) => DamageDealt | null;
  readonly targets: () => readonly ConeFanTarget[];
}
/** The arc slash's numbers: its cone, the light and heavy damage, their cooldowns (s), the contact tags and move ids. */
export interface ConeSlashSpec {
  readonly reach: number; readonly halfAngle: number; readonly light: number; readonly heavy: number;
  readonly cooldown: number; readonly heavyCooldown: number;
  readonly tags: readonly CombatTag[]; readonly moves: { readonly light: string; readonly heavy: string };
}
/** The gust's numbers: its cone, the push (m/s level and up), the wind hit, its cooldown (s), the contact tags and move id. */
export interface ConeGustSpec {
  readonly reach: number; readonly halfAngle: number; readonly push: number; readonly lift: number; readonly damage: number;
  readonly cooldown: number; readonly tags: readonly CombatTag[]; readonly move: string;
}
/** A cone fan's strikes: the weapon id every contact names, the slash and the gust. */
export interface ConeStrikeSpec { readonly weaponId: string; readonly slash: ConeSlashSpec; readonly gust: ConeGustSpec }

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  const d = to.clone().sub(from), len = d.length();
  if (len > reach) return false; if (len < 1e-3) return true;
  return d.dot(dir) / (len * Math.max(dir.length(), 1e-6)) >= Math.cos(halfAngle);
}

const finite = v.pipe(v.number(), v.finite(), v.minValue(0));
const Saved = v.strictObject({ cooldown: finite, gustCooldown: finite });

/**
 * A cone fan's moves, view-free: the SWING / HEAVY cooldowns and arc slash through the damage pipeline, and the GUST
 * cone's impulse and wind hit. The held `ConeFan` and a renderer-free host's adapter run this one recipe; its two
 * cooldowns are exact continuation.
 */
export class ConeStrikes {
  /** Seconds until the next SWING / HEAVY, and the next GUST. */
  cooldown = 0; gustCooldown = 0;
  private readonly spec: ConeStrikeSpec;
  private readonly ports: ConeStrikePorts;
  constructor(spec: ConeStrikeSpec, ports: ConeStrikePorts) { this.spec = spec; this.ports = ports; }
  /** Claim a swing: false while cooling down, otherwise the move's cooldown starts. */
  startSwing(heavy: boolean): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = heavy ? this.spec.slash.heavyCooldown : this.spec.slash.cooldown; return true;
  }
  /** Claim a gust: false while cooling down, otherwise its cooldown starts. */
  startGust(): boolean {
    if (this.gustCooldown > 0) return false;
    this.gustCooldown = this.spec.gust.cooldown; return true;
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean, struckOne?: (actorId: string, killed: boolean) => void): number {
    const s = this.spec.slash;
    let struck = 0;
    for (const target of this.ports.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, s.reach, s.halfAngle)) continue;
      const result = this.ports.hit({ source: 'env', sourceTags: [...s.tags], target: target.actor,
        amount: heavy ? s.heavy : s.light, point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: this.spec.weaponId,
        moveId: heavy ? s.moves.heavy : s.moves.light, surface: 'flesh' });
      if (result !== null) { struck++; struckOne?.(target.actor.id, result.killed); }
    }
    return struck;
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number {
    const g = this.spec.gust;
    let blown = 0;
    for (const target of this.ports.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, g.reach, g.halfAngle)) continue;
      const away = target.position.clone().sub(from); away.y = 0; if (away.lengthSq() < 1e-4) away.set(dir.x, 0, dir.z); away.normalize();
      target.impulse?.(away.multiplyScalar(g.push).setY(g.lift));
      this.ports.hit({ source: 'env', sourceTags: [...g.tags], target: target.actor, amount: g.damage,
        point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: this.spec.weaponId, moveId: g.move, surface: 'flesh' });
      blown++;
    }
    return blown;
  }
  /** Count both cooldowns down by `dt` seconds. */
  tick(dt: number): void { this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt); }
  /** The continuation: both cooldowns. */
  snapshot(): { cooldown: number; gustCooldown: number } { return { cooldown: this.cooldown, gustCooldown: this.gustCooldown }; }
  /** Take a snapshot back (validated). */
  restore(value: unknown): void { const saved = v.parse(Saved, value); this.cooldown = saved.cooldown; this.gustCooldown = saved.gustCooldown; }
}
