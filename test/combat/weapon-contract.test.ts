import { describe, expect, it } from 'vitest';
import { Sword } from '#kit/weapons/melee/SweptMelee';
import { Crossbow } from '#kit/weapons/crossbow/Crossbow';
import { Bow } from '#kit/weapons/bow/index';
import { Longbow } from '#shards/pine-hollow/weapons/Longbow';
import { Rifle } from '#kit/weapons/firearm/Rifle';
import { Spear } from '#shards/nalati-grasslands/weapons/Spear';
import { Sabre } from '#shards/nalati-grasslands/weapons/Sabre';
import { LeverRifle } from '#shards/pine-hollow/weapons/LeverRifle';

// Today's public behavior surface: the new equipment class / ids / UI rows are introduced in S1.2.
describe('all current weapon behaviors expose the shared action surface', () => {
  it.each([Sword, Crossbow, Bow, Longbow, Rifle, Spear, Sabre, LeverRifle])('%s', (weapon) => {
    for (const method of ['tryFire', 'update', 'inputAllowed', 'aimRay']) expect(Reflect.get(weapon.prototype, method), `${weapon.name}.${method}`).toBeTypeOf('function');
  });
});
