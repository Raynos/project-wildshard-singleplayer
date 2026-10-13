import type { ContactFamily, ContactFamilyPorts, ContactWorldTarget } from '@wildshard/engine/combat/contactWeapon';
import type { Vector3 } from 'three';
import { bindMeleeContacts } from '@wildshard/game/plugin/simulation';
import { parseWeaponProfile, type WeaponProfile, type MeleeContactRow } from '@wildshard/format/weaponProfiles';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import type { Actor, CombatTag, CombatTarget } from '@wildshard/engine/combat/pipeline';

/** The admitted family's chest height and lane body allowance in metres. */
export type LashContact = NonNullable<Extract<WeaponProfile, { family: 'lash' }>['contact']>;

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

