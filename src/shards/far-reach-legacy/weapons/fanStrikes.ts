import * as v from 'valibot';
import type { Vector3 } from 'three';
import type { Actor, DamageDealt, DamageRequest } from '@wildshard/engine/combat/pipeline';
import { FAN_GUST, FAN_SWING } from '../data/items';

/** The declared fan row's id (data/items.ts, weapons/rows.ts): every contact names it as its weapon. */
export const FAN_ID = 'weapon.far-reach.fan';
/** Anything the fan can strike: a world position and its combat actor. */
export interface FanTarget { readonly position: Vector3; readonly actor: Actor | null; impulse?: (velocity: Vector3) => void }
/** What the fan's contacts are lent: the damage pipeline's contact and the live targets, in the combat query's order. */
export interface FanPorts {
  readonly hit: (req: DamageRequest) => DamageDealt | null;
  readonly targets: () => readonly FanTarget[];
}

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  const d = to.clone().sub(from), len = d.length();
  if (len > reach) return false; if (len < 1e-3) return true;
  return d.dot(dir) / (len * Math.max(dir.length(), 1e-6)) >= Math.cos(halfAngle);
}

const finite = v.pipe(v.number(), v.finite(), v.minValue(0));
const Saved = v.strictObject({ cooldown: finite, gustCooldown: finite });

/**
 * The war fan's moves, view-free (G51: the trusted cone / heavy / impulse recipe, SF72): the SWING / HEAVY cooldowns and
 * arc slash through the damage pipeline, and the GUST cone's impulse and small wind hit. The browser's WarFan (its
 * viewmodel, input, charge hold and cues) and the renderer-free host's adapter (runtime/fan.ts) run this one recipe.
 */
export class FanStrikes {
  /** Seconds until the next SWING / HEAVY, and the next GUST. */
  cooldown = 0; gustCooldown = 0;
  private readonly ports: FanPorts;
  constructor(ports: FanPorts) { this.ports = ports; }
  /** Claim a swing: false while cooling down, otherwise the move's cooldown starts. */
  startSwing(heavy: boolean): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = heavy ? FAN_SWING.heavyCooldown : FAN_SWING.cooldown; return true;
  }
  /** Claim a gust: false while cooling down, otherwise its cooldown starts. */
  startGust(): boolean {
    if (this.gustCooldown > 0) return false;
    this.gustCooldown = FAN_GUST.cooldown; return true;
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean, struckOne?: (actorId: string, killed: boolean) => void): number {
    let struck = 0;
    for (const target of this.ports.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, FAN_SWING.reach + 1, FAN_SWING.halfAngle)) continue;
      const result = this.ports.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], target: target.actor,
        amount: heavy ? FAN_SWING.heavy : FAN_SWING.light, point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: FAN_ID,
        moveId: heavy ? 'far.fan.heavy' : 'far.fan.light', surface: 'flesh' });
      if (result !== null) { struck++; struckOne?.(target.actor.id, result.killed); }
    }
    return struck;
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number {
    let blown = 0;
    for (const target of this.ports.targets()) {
      if (target.actor === null || !target.actor.alive || !inCone(from, dir, target.position, FAN_GUST.reach, FAN_GUST.halfAngle)) continue;
      const away = target.position.clone().sub(from); away.y = 0; if (away.lengthSq() < 1e-4) away.set(dir.x, 0, dir.z); away.normalize();
      target.impulse?.(away.multiplyScalar(FAN_GUST.push).setY(FAN_GUST.lift));
      this.ports.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], target: target.actor, amount: FAN_GUST.damage,
        point: target.position.clone(), dir: dir.clone(), from: from.clone(), weaponId: FAN_ID, moveId: 'far.fan.gust', surface: 'flesh' });
      blown++;
    }
    return blown;
  }
  /** Count both cooldowns down by `dt` seconds. */
  tick(dt: number): void { this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt); }
  snapshot(): { cooldown: number; gustCooldown: number } { return { cooldown: this.cooldown, gustCooldown: this.gustCooldown }; }
  restore(value: unknown): void { const saved = v.parse(Saved, value); this.cooldown = saved.cooldown; this.gustCooldown = saved.gustCooldown; }
}
