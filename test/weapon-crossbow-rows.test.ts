import { expect, it } from 'vitest';
import { parseItems } from '@wildshard/format/items';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { PINE_ITEMS } from '../src/shards/pine-hollow/data/items';
import { CROSSBOW_WEAPON_PROFILE as profile } from '../src/shards/pine-hollow/data/crossbowProfile';
import { CROSSBOW_PROFILE, crossbowProfile, parseCrossbowProfile } from '../src/shards/pine-hollow/weapons/crossbow/profiles';

it('declares both actual ranged owners on firearm while preserving their distinct native view recipes', () => {
  const rows = parseItems(PINE_ITEMS).rows;
  const bolt = rows.find(row => row.id === 'weapon.crossbow'), lever = rows.find(row => row.id === 'weapon.lever');
  if (bolt?.kind !== 'weapon' || lever?.kind !== 'weapon') throw new Error('Missing actual ranged items');
  expect([bolt.family, lever.family]).toEqual(['firearm', 'firearm']);
  expect([bolt.view.recipe, lever.view.recipe]).toEqual(['pine-hollow.crossbow', 'pine-hollow.lever']);
  expect(bolt.profile).toEqual(profile); expect(parseWeaponProfile(profile)).toEqual(profile);
  expect(CROSSBOW_PROFILE).toEqual({ family: 'crossbow', quiver: 30, speed: 62, gravity: 9.8, drag: 0.012, radius: 0.03, bury: 0.08,
    reload: 1.35, autoReload: 1.4, cooldown: 0.3, kick: 0.8 * (Math.PI / 180), adsBlend: 0.18, adsMotion: 0.3, maxFlying: 8, maxStuck: 200,
    spreadAds: 0.15, spreadHip: 0.75, spreadRadius: 'linear', spreadAxisScale: 2, muzzle: 0.35, substeps: 4, lifetime: 12, damageScale: 1 });
});
it('admits changed bolt clocks and flight but refuses unhosted actions, bloom, movement and wind before native ownership', () => {
  const changed = { ...profile, reserve: 4, reload: 0.4, interval: 0.1, projectile: { ...profile.projectile, speed: 31, pool: 2 } };
  expect(crossbowProfile(changed)).toMatchObject({ quiver: 5, reload: 0.4, cooldown: 0.1, speed: 31, maxFlying: 2 });
  for (const bad of [{ ...profile, action: 'semi' }, { ...profile, magazine: 2 }, { ...profile, reloadMode: 'magazine' },
    { ...profile, bloomShot: 1 }, { ...profile, movingSpread: 1 }, { ...profile, range: 311 }, { ...profile, spreadAxisScale: undefined },
    { ...profile, projectile: { ...profile.projectile, muzzle: undefined } },
    { ...profile, projectile: { ...profile.projectile, pool: 0 } }, { ...profile, projectile: { ...profile.projectile, delivery: 'hitscan' } },
    { ...profile, projectile: { ...profile.projectile, flight: { ...profile.projectile.flight, windCoupling: 1 } } }]) expect(() => parseCrossbowProfile(bad)).toThrow();
});
