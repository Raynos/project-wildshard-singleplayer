import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { parseItems } from '@wildshard/format/items';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { Thrown } from '../src/shards/nalati-grasslands/runtime/weapons/Thrown';
import { JAVELIN, javelinFlightStep } from '../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { NALATI_ITEMS } from '../src/shards/nalati-grasslands/data/items';
import { JAVELIN_WEAPON_PROFILE as profile } from '../src/shards/nalati-grasslands/data/javelinProfile';

// Original public native profile: independent frozen values, including the spear's retained weapon.javelin identity.
const shipping = { id: 'weapon.javelin', speed: 28, gravity: 9.8, damage: 55, headMultiplier: 2,
  radius: 0.03, headOffset: 0.8, windup: 0.4, release: 0.14, recovery: 0.45,
  carried: 3, pool: 5, pickupRadius: 1.6, pickupHeight: 2.2, survive: 0.9,
  arcPoints: 32, arcAfter: 0.12, stagger: 1 } as const;
it('declares the actual spear-slot throw owner without changing its identity or native view', () => {
  const row = parseItems(NALATI_ITEMS).rows.find(item => item.id === 'weapon.spear');
  if (row?.kind !== 'weapon') throw new Error('Missing native spear declaration');
  expect(row.family).toBe('thrown'); expect(row.view.recipe).toBe('nalati-grasslands.spear');
  expect(row.profile).toEqual(profile); expect(parseWeaponProfile(profile)).toEqual(profile);
  expect(JAVELIN).toEqual(shipping);
});
it('retains the actual helper ammunition and every shipping flight substep over 10k mixed deltas', () => {
  const actual = new Thrown(JAVELIN), previous = new Thrown(shipping);
  const pos = new Vector3(3, 1.68, 2), velocity = new Vector3(11, 19, -28), oldPos = pos.clone(), oldVelocity = velocity.clone();
  const loosePos = pos.clone(), looseVelocity = velocity.clone();
  for (let tick = 0; tick < 10000; tick++) {
    const dt = [1 / 120, 1 / 240, 1 / 180][tick % 3] ?? 1 / 120;
    actual.flightStep(pos, velocity, dt); previous.flightStep(oldPos, oldVelocity, dt);
    javelinFlightStep(loosePos, looseVelocity, dt);
    expect(pos.toArray()).toEqual(oldPos.toArray()); expect(velocity.toArray()).toEqual(oldVelocity.toArray());
    expect(loosePos.toArray()).toEqual(oldPos.toArray()); expect(looseVelocity.toArray()).toEqual(oldVelocity.toArray());
    if (tick % 127 === 0) { expect(actual.release()).toBe(previous.release()); expect(actual.ammo).toBe(previous.ammo); }
  }
});
