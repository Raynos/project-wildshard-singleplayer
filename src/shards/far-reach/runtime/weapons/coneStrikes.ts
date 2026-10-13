import * as v from 'valibot';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { ContactFamily, weaponContactDistance, type ContactFamilyPorts, type ContactMoveRow } from '@wildshard/engine/combat/contactWeapon';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { Vector3 } from 'three';
import type { Actor, CombatTag } from '@wildshard/engine/combat/pipeline';

/**
 * A cone fan's moves, view-free (SHARD-PLATFORM M3; the held weapon is `./coneFan`): the SWING / HEAVY cooldowns and arc
 * slash through the damage pipeline, and the GUST cone's impulse and wind hit. A renderer-free host's adapter runs this
 * module alone (it imports no view); its continuation is `{ cooldown, gustCooldown }`.
 */

/** Anything the fan can strike: a world position and its combat actor, and how it takes the gust's push. */
export interface ConeFanTarget { readonly position: Vector3; readonly actor: Actor | null; impulse?: (velocity: Vector3) => void }
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

/** True when `to` lies inside a cone of `reach` metres and `halfAngle` radians around `dir` from `from`. */
export function inCone(from: Vector3, dir: Vector3, to: Vector3, reach: number, halfAngle: number): boolean {
  return weaponContactDistance(from, dir, to, 'cone', reach, halfAngle) !== null;
}

/** A cone fan's moves at work: the shared contact family on its rows, 0 the SWING, 1 the HEAVY (one lane), 2 the GUST (its own lane). */
export type ConeStrikes = ContactFamily<ConeFanTarget>;
/** The cone fan's rows: the arc slashes on every live target in the cone, and the GUST's push before its wind hit. */
export function coneRows(spec: ConeStrikeSpec): ContactMoveRow[] {
  const common = { source: 'env', weaponId: spec.weaponId, copyVectors: true, copyTags: true } as const, s = spec.slash, g = spec.gust;
  const slash = { lane: 'primary', shape: 'cone', reach: s.reach, size: s.halfAngle, height: 0, allowance: 0, lands: [], show: 0, reports: true } as const;
  return [{ ...slash, heavy: false, cooldown: s.cooldown, hits: [{ ...common, damage: s.light, tags: s.tags, moveId: s.moves.light, reactions: [] }] },
    { ...slash, heavy: true, cooldown: s.heavyCooldown, hits: [{ ...common, damage: s.heavy, tags: s.tags, moveId: s.moves.heavy, reactions: [] }] },
    { ...slash, lane: 'secondary', heavy: false, cooldown: g.cooldown, reach: g.reach, size: g.halfAngle, reports: false,
      hits: [{ ...common, damage: g.damage, tags: g.tags, moveId: g.move, reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: g.push, lift: g.lift }] }] }];
}
/** A cone fan's moves on the shared family, lent the pipeline's contact, the live targets in the combat query's order and its hit report. */
export function coneStrikes(spec: ConeStrikeSpec, ports: Pick<ContactFamilyPorts<ConeFanTarget>, 'hit' | 'targets' | 'struck'>): ConeStrikes {
  return new ContactFamily<ConeFanTarget>(coneRows(spec), ports);
}
/** Adopt the same weapon's admitted parameters without restarting either retained cooldown. */
export function configureCone(fan: ConeStrikes, row: ItemSpec, input: unknown): void {
  const spec = coneStrikeSpec(row, input);
  if (spec.weaponId !== fan.row(0).hits[0]?.weaponId) throw new Error('Cone profile cannot replace the native weapon identity');
  fan.moves = coneRows(spec);
}

const finite = v.pipe(v.number(), v.finite(), v.minValue(0));
const Saved = v.strictObject({ cooldown: finite, gustCooldown: finite });
/** The continuation: both cooldowns. */
export function coneSnapshot(fan: ConeStrikes): { cooldown: number; gustCooldown: number } { return { cooldown: fan.cooldown, gustCooldown: fan.secondaryCooldown }; }
/** Take a snapshot back (validated). */
export function coneRestore(fan: ConeStrikes, value: unknown): void { const saved = v.parse(Saved, value); fan.cooldown = saved.cooldown; fan.secondaryCooldown = saved.gustCooldown; }
