import { RIFLE_WEAPON_PROFILE } from './rifleProfile';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';

/** Existing carbine tuning retained as shard-owned data during the weapon row conversion. */
export const AR15: FirearmProfile = {
  family: RIFLE_WEAPON_PROFILE.family, action: RIFLE_WEAPON_PROFILE.action,
  magazine: RIFLE_WEAPON_PROFILE.magazine, reserve: RIFLE_WEAPON_PROFILE.reserve, interval: RIFLE_WEAPON_PROFILE.interval,
  reload: RIFLE_WEAPON_PROFILE.reload, autoReload: RIFLE_WEAPON_PROFILE.autoReload,
  damageScale: RIFLE_WEAPON_PROFILE.damageScale, range: RIFLE_WEAPON_PROFILE.range, kick: 0.35 * (Math.PI / 180),
  spreadAds: RIFLE_WEAPON_PROFILE.spreadAds, spreadHip: RIFLE_WEAPON_PROFILE.spreadHip, spreadRadius: RIFLE_WEAPON_PROFILE.spreadRadius,
  bloomShot: RIFLE_WEAPON_PROFILE.bloomShot, bloomMax: RIFLE_WEAPON_PROFILE.bloomMax,
  movingSpread: RIFLE_WEAPON_PROFILE.movingSpread, movingAimReduction: RIFLE_WEAPON_PROFILE.movingAimReduction,
  brass: { count: 3, life: 1.4 }, tracer: { count: 3, life: 0.09, width: 3 },
  ads: { blend: 0.16, motion: 0.3, nearMargin: 0.03, sightY: 0.064, rearZ: 0.10, frontZ: -0.455, muzzleZ: -0.645 },
};
