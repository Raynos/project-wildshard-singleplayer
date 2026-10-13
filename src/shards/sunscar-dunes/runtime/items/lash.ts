import { weaponContactDistance, type ContactFamily, type ContactFamilyPorts, type ContactWorldTarget } from '@wildshard/engine/combat/contactWeapon';
import { Vector3 } from 'three';
import { bindMeleeContacts } from '@wildshard/game/plugin/simulation';
import { parseWeaponProfile, type WeaponProfile, type MeleeContactRow } from '@wildshard/format/weaponProfiles';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { Actor, CombatTag, CombatTarget } from '@wildshard/engine/combat/pipeline';

/** The admitted family's chest height and lane body allowance in metres. */
export type LashContact = NonNullable<Extract<WeaponProfile, { family: 'lash' }>['contact']>;

/** A creature's hit volumes in world space: the head ball and the body capsule (the shapes `CreatureBodies` poses). */
export interface LashVolumes {
  readonly head: Vector3; readonly headRadius: number;
  readonly a: Vector3; readonly b: Vector3; readonly bodyRadius: number;
}

const oc = new Vector3(), ba = new Vector3(), oa = new Vector3(), closest = new Vector3();

/** First non-negative hit of the ray on a ball, or null (the origin is outside it). */
function ball(from: Vector3, dir: Vector3, centre: Vector3, radius: number): number | null {
  oc.subVectors(from, centre);
  const b = oc.dot(dir), c = oc.lengthSq() - radius * radius, h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/**
 * The lash's first contact with a creature's volumes along `dir` (unit) within `reach`, in metres from `from`, or null:
 * the same test the browser's shared raycast runs against the posed head ball and body capsule. An origin inside a
 * volume touches it at once (Rapier's solid cast answers 0 there too).
 */
export function lashVolumeHit(from: Vector3, dir: Vector3, reach: number, body: LashVolumes): number | null {
  ba.subVectors(body.b, body.a); oa.subVectors(from, body.a);
  const baba = ba.lengthSq(), along = baba > 1e-12 ? Math.min(1, Math.max(0, oa.dot(ba) / baba)) : 0;
  closest.copy(body.a).addScaledVector(ba, along);
  if (from.distanceToSquared(closest) <= body.bodyRadius ** 2 || from.distanceToSquared(body.head) <= body.headRadius ** 2) return 0;
  let best = Infinity;
  // the capsule's side: the infinite cylinder's entry, kept only between its two caps
  const bard = ba.dot(dir), baoa = ba.dot(oa), rdoa = dir.dot(oa), a = baba - bard * bard;
  if (a > 1e-12) {
    const b = baba * rdoa - baoa * bard, c = baba * oa.lengthSq() - baoa * baoa - body.bodyRadius ** 2 * baba, h = b * b - a * c;
    if (h >= 0) { const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard; if (t >= 0 && y > 0 && y < baba) best = t; }
  }
  // its two caps and the head
  for (const t of [ball(from, dir, body.a, body.bodyRadius), ball(from, dir, body.b, body.bodyRadius), ball(from, dir, body.head, body.headRadius)]) if (t !== null && t < best) best = t;
  return best <= reach ? best : null;
}

/**
 * The lash's lane: how far along `dir` a target's chest (`contact.chestHeight` over its feet) sits when it is inside the narrow
 * lane (`reach` + `contact.bodyAllowance` long, `width` + `contact.bodyAllowance` wide), or null. The lash lands at `min(forward, reach)`.
 */
export function lashLane(from: Vector3, dir: Vector3, reach: number, width: number, feet: Vector3, contact: LashContact): number | null {
  return weaponContactDistance(from, dir, feet, 'lane', reach, width, contact.chestHeight, contact.bodyAllowance);
}

/**
 * One lash's contact rule on one creature: the first hit on its head ball or body capsule inside the reach, else its
 * chest in the lane; the distance along the ray where it lands.
 */
export function lashContact(from: Vector3, dir: Vector3, reach: number, width: number, body: LashVolumes, feet: Vector3, contact: LashContact): number | null {
  const hit = lashVolumeHit(from, dir, reach, body);
  if (hit !== null) return hit;
  const lane = lashLane(from, dir, reach, width, feet, contact);
  return lane === null ? null : Math.min(lane, reach);
}

/** The lash's own timing (seconds) and reactions: the unroll, the heavy's second lash, how long it shows, the stagger, the yank (m/s on ≤ `pullMaxHp`). */
export type LashTiming = Extract<WeaponProfile, { family: 'lash' }>['timing'];
/** The move ids a lash's hits carry: the light crack, and the heavy double crack's first and second lash. */
export type LashMoves = Extract<WeaponProfile, { family: 'lash' }>['moves'];
/** A lash's numbers: reach, width, damage and cooldowns from its declared weapon row, its timing, tags and moves. */
export interface LashSpec extends LashTiming {
  readonly id: string; readonly reach: number; readonly heavyReach: number; readonly width: number;
  readonly light: number; readonly heavy: number; readonly cooldown: number; readonly heavyCooldown: number; readonly charge: number;
  readonly tags: readonly CombatTag[]; readonly moves: LashMoves; readonly contact: LashContact;
  readonly contacts: readonly MeleeContactRow[];
}
/** Project the admitted melee contacts into the retained cord view's numbers; no private move construction or clock. */
export function lashSpec(row: ItemSpec & { readonly contacts?: readonly MeleeContactRow[] }, input: unknown): LashSpec {
  const profile = parseWeaponProfile(input);
  if (row.kind !== 'weapon' || profile.family !== 'lash' || profile.contact === undefined || row.contacts === undefined) throw new Error(`Item ${row.id} requires its native lash profile`);
  const [light, heavy] = row.contacts, first = light?.hits[0], double = heavy?.hits[0], second = heavy?.hits[1];
  const unroll = light?.lands[0], secondAt = heavy?.lands[1];
  if (row.contacts.length !== 2 || light?.shape !== 'lane' || heavy?.shape !== 'lane' || light.heavy || !heavy.heavy
    || light.lands.length !== 1 || heavy.lands.length !== 2 || heavy.lands[0] !== unroll
    || unroll === undefined || secondAt === undefined || first === undefined || double === undefined || second === undefined) {
    throw new Error(`Item ${row.id} requires its ordered light/double melee contacts`);
  }
  return { id: row.id, reach: light.reach, heavyReach: heavy.reach, width: light.size, light: first.damage, heavy: double.damage,
    cooldown: light.cooldown, heavyCooldown: heavy.cooldown, charge: row.charge, contacts: row.contacts, tags: first.tags,
    moves: { light: first.moveId, first: double.moveId, second: second.moveId },
    contact: { chestHeight: light.height, bodyAllowance: light.allowance }, ...profile.timing, unroll, second: secondAt, show: light.show };
}

/** A lash's runtime: the shared contact family on its rows, 0 the light crack and 1 the heavy double crack. */
export type LashRuntime = ContactFamily<CombatTarget>;
/** Something a lash can crack in the world (a lever, a brazier): `crack` says whether it reacted. */
export type LashWorldTarget = ContactWorldTarget;
/** The lash's ports: its aim at each landing, the first body it meets, the lane's candidates, the world, the pipeline, the hits' source. */
export type LashPorts = Omit<ContactFamilyPorts<CombatTarget>, 'react'> & { readonly source: Actor | 'env' };

/**
 * A lash weapon's crack (SF72, SF85) as two rows on the shared contact family: a light crack is one long, narrow lash
 * along the aim `unroll` seconds after the swing; the heavy a double crack whose second lash lands at `second`. Each lash
 * takes the first body it meets, else the nearest hittable chest in its lane, else the nearest world target in it. The
 * heavy's first lash yanks a small creature (<= `pullMaxHp`) toward the player; its second staggers a big one.
 */
export function lashRuntime(spec: LashSpec, ports: LashPorts): LashRuntime {
  return bindMeleeContacts<CombatTarget>(spec.id, spec.contacts,
    { ...ports, owner: ports.source, react: port => ({ actor: port.actor, ...(port.impulse === undefined ? {} : { impulse: port.impulse }),
      stagger: (dir: Vector3, strength: number): void => { port.target.stagger?.(dir, strength); } }) });
}

/** A lash's exact continuation. */
export interface LashState { readonly cooldown: number; readonly crackT: number; readonly heavy: boolean; readonly landed: number }
export function lashSnapshot(lash: LashRuntime): LashState { return { cooldown: lash.cooldown, crackT: lash.t, heavy: lash.move === 1, landed: lash.landed }; }
export function lashRestore(lash: LashRuntime, saved: LashState): void {
  if (!Number.isFinite(saved.cooldown) || saved.cooldown < 0 || !Number.isFinite(saved.crackT) || saved.crackT < -1
    || ![0, 1, 2].includes(saved.landed) || (saved.landed === 2 && !saved.heavy)) throw new RangeError('Invalid lash snapshot');
  lash.cooldown = saved.cooldown; lash.t = saved.crackT; lash.move = saved.heavy ? 1 : 0; lash.landed = saved.landed;
}
