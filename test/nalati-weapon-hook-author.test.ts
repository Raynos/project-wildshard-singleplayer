// oxlint-disable-next-line import/no-nodejs-modules -- Compare generated products to the retained native baseline, not producer input.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateNalatiWeaponHooks } from '../src/shards/nalati-grasslands/generators/weaponHooks';
import { SABRE_WEAPON_PROFILE } from '../src/shards/nalati-grasslands/data/sabreProfile';
import { SABRE_HOOK } from '../src/shards/nalati-grasslands/data/sabreHook';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';

it('rebuilds the original native sabre module and every hook bound from retained author source', async () => {
  const source = readFileSync('src/shards/nalati-grasslands/behaviour/weapons.as', 'utf8');
  const generated = await generateNalatiWeaponHooks(source);
  const retained: unknown = JSON.parse(readFileSync('src/shards/nalati-grasslands/behaviour/weapons.json', 'utf8'));
  expect(generated.declaration).toEqual(retained);
  expect(hashImmutableBytes(generated.bytes)).toBe('141ad375895d4f14fc900f0954c566ff077d1621741aed238edffa672f41a9ac');
  expect(generated.module).toBe(hashImmutableBytes(generated.bytes));
  expect(SABRE_HOOK.parameters).toEqual([SABRE_WEAPON_PROFILE.mounted.speedDivisor,
    SABRE_WEAPON_PROFILE.mounted.chainStep, SABRE_WEAPON_PROFILE.mounted.chainMax]);
});
