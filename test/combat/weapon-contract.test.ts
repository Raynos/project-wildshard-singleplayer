import { describe, expect, it } from 'vitest';
import { Sword } from '../../src/kit/weapons/melee/SweptMelee';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { Bow } from '../../src/kit/weapons/bow/family';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';
import { Spear } from '../../src/shards/nalati-grasslands/weapons/Spear';
import { Sabre } from '../../src/shards/nalati-grasslands/weapons/Sabre';
import { LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';

// Today's public behavior surface: the new equipment class / ids / UI rows are introduced in S1.2.
describe('all current weapon behaviors expose the shared action surface', () => {
  it.each([Sword, Crossbow, Bow, Rifle, Spear, Sabre, LeverRifle])('%s', (weapon) => {
    for (const method of ['tryFire', 'update', 'aimRay']) expect(Reflect.get(weapon.prototype, method), `${weapon.name}.${method}`).toBeTypeOf('function');
  });
});
