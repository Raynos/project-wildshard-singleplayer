import { expect, it } from 'vitest';
import { parseItems } from '@wildshard/format/items';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { NALATI_ITEMS } from '../src/shards/nalati-grasslands/data/items';
import { AR15 } from '../src/shards/nalati-grasslands/data/firearmProfile';
import { RIFLE_WEAPON_PROFILE as profile } from '../src/shards/nalati-grasslands/data/rifleProfile';
import { AR15 as shipping } from './fixtures/weapon-oracle/nalatiRifleProfile';
import { instantSpreadDegrees } from '../src/engine/combat/shotSpread';

it('declares the actual semi-auto magazine owner on firearm without changing its native view recipe or tuning', () => {
  const row = parseItems(NALATI_ITEMS).rows.find(item => item.id === 'weapon.rifle');
  if (row?.kind !== 'weapon') throw new Error('Missing native rifle declaration');
  expect(row.family).toBe('firearm'); expect(row.view.recipe).toBe('nalati-grasslands.rifle');
  expect(row.profile).toEqual(profile); expect(parseWeaponProfile(profile)).toEqual(profile);
  expect(AR15).toEqual(shipping);
});
it('retains the exact shipping hitscan cone over 10k ADS, movement and bloom inputs', () => {
  for (let tick = 0; tick < 10000; tick++) {
    const ads = (tick % 97) / 96, speed = (tick % 31) / 30, bloom = Math.min((tick % 7) * profile.bloomShot, profile.bloomMax);
    expect(instantSpreadDegrees(profile.spreadAds, profile.spreadHip, ads, bloom, speed, profile.movingSpread, profile.movingAimReduction))
      .toBe(instantSpreadDegrees(shipping.spreadAds, shipping.spreadHip, ads, bloom, speed, shipping.movingSpread, shipping.movingAimReduction));
  }
});
