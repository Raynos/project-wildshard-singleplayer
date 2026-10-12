import * as v from 'valibot';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { ContactWeaponHost, weaponContactDistance, type WeaponContactMove } from '@wildshard/engine/combat/contactWeapon';
import type { ItemSpec } from '@wildshard/engine/combat/items';
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

/** Build contact parameters from an admitted item and its cone profile before touching the native owner. */
export function coneStrikeSpec(row: ItemSpec, input: unknown): ConeStrikeSpec {
  const profile = parseWeaponProfile(input);
  if (row.kind !== 'weapon' || profile.family !== 'cone') throw new Error('Cone family requires a weapon and cone profile');
  const light = row.light, heavy = row.heavy;
  if (light.range !== heavy.range || light.width !== heavy.width || light.width > Math.PI
    || light.effect !== null || heavy.effect !== null || light.tags.length !== heavy.tags.length
    || light.tags.some((tag, index) => tag !== heavy.tags[index])) throw new Error('Cone slashes require one shared contact shape and tags');
  return { weaponId: row.id, slash: { reach: light.range + profile.slash.reachAllowance, halfAngle: light.width,
    light: light.damage, heavy: heavy.damage, cooldown: light.cooldown, heavyCooldown: heavy.cooldown,
    tags: [...light.tags], moves: { light: light.id, heavy: heavy.id } }, gust: profile.gust };
}

function coneMoves(spec: ConeStrikeSpec): readonly [WeaponContactMove, WeaponContactMove, WeaponContactMove] {
  const common = { source: 'env', weaponId: spec.weaponId, copyVectors: true, copyTags: true } as const;
  return [{ ...common, damage: spec.slash.light, tags: spec.slash.tags, moveId: spec.slash.moves.light, reactions: [] },
    { ...common, damage: spec.slash.heavy, tags: spec.slash.tags, moveId: spec.slash.moves.heavy, reactions: [] },
    { ...common, damage: spec.gust.damage, tags: spec.gust.tags, moveId: spec.gust.move,
      reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: spec.gust.push, lift: spec.gust.lift }] }];
}

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  return weaponContactDistance(from, dir, to, 'cone', reach, halfAngle) !== null;
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
  get cooldown(): number { return this.host.primary; }
  set cooldown(value: number) { this.host.primary = value; }
  get gustCooldown(): number { return this.host.secondary; }
  set gustCooldown(value: number) { this.host.secondary = value; }
  private readonly host: ContactWeaponHost;
  private spec: ConeStrikeSpec;
  private moves: readonly [WeaponContactMove, WeaponContactMove, WeaponContactMove];
  private readonly ports: ConeStrikePorts;
  constructor(spec: ConeStrikeSpec, ports: ConeStrikePorts) { this.spec = spec; this.moves = coneMoves(spec); this.ports = ports; this.host = new ContactWeaponHost(req => ports.hit(req)); }
  /** Adopt the same weapon's admitted parameters without restarting either retained cooldown. */
  configure(row: ItemSpec, input: unknown): void {
    const spec = coneStrikeSpec(row, input);
    if (spec.weaponId !== this.spec.weaponId) throw new Error('Cone profile cannot replace the native weapon identity');
    this.spec = spec; this.moves = coneMoves(spec);
  }
  /** Claim a swing: false while cooling down, otherwise the move's cooldown starts. */
  startSwing(heavy: boolean): boolean {
    return this.host.claim('primary', heavy ? this.spec.slash.heavyCooldown : this.spec.slash.cooldown);
  }
  /** Claim a gust: false while cooling down, otherwise its cooldown starts. */
  startGust(): boolean {
    return this.host.claim('secondary', this.spec.gust.cooldown);
  }
  /** One slash from `from` along `dir`: every target in the arc takes a hit. Returns how many were struck. */
  slash(from: Vector3, dir: Vector3, heavy: boolean, struckOne?: (actorId: string, killed: boolean) => void): number {
    const s = this.spec.slash;
    let struck = 0;
    const targets = this.ports.targets();
    if (targets.length > 4096) throw new RangeError('Cone targets exceed the admitted actor bound');
    for (let i = 0; i < 4096; i++) {
      const target = targets[i]; if (target === undefined) break;
      const actor = target.actor;
      if (actor === null || !actor.alive || !inCone(from, dir, target.position, s.reach, s.halfAngle)) continue;
      const result = this.host.contact(target, this.moves[heavy ? 1 : 0], target.position, dir, from, struckOne);
      if (result !== null) struck++;
    }
    return struck;
  }
  /** The GUST cone: an impulse away from `from` (plus a little lift) and a small hit on each target inside it. */
  blow(from: Vector3, dir: Vector3): number {
    const g = this.spec.gust;
    let blown = 0;
    const targets = this.ports.targets();
    if (targets.length > 4096) throw new RangeError('Cone targets exceed the admitted actor bound');
    for (let i = 0; i < 4096; i++) {
      const target = targets[i]; if (target === undefined) break;
      const actor = target.actor;
      if (actor === null || !actor.alive || !inCone(from, dir, target.position, g.reach, g.halfAngle)) continue;
      this.host.contact(target, this.moves[2], target.position, dir, from);
      blown++;
    }
    return blown;
  }
  /** Count both cooldowns down by `dt` seconds. */
  tick(dt: number): void { this.host.countDown(dt); }
  /** The continuation: both cooldowns. */
  snapshot(): { cooldown: number; gustCooldown: number } { return { cooldown: this.cooldown, gustCooldown: this.gustCooldown }; }
  /** Take a snapshot back (validated). */
  restore(value: unknown): void { const saved = v.parse(Saved, value); this.cooldown = saved.cooldown; this.gustCooldown = saved.gustCooldown; }
}
