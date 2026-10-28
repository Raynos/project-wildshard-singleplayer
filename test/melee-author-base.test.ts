// oxlint-disable-next-line import/no-nodejs-modules -- Prove the actual author factory stays below the unchanged native renderer guard.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { Vector3, Quaternion, Color } from 'three';
import { sharedMeleeAuthorBase } from '../src/sdk/weapons/meleeProfile';
import { parseThrownWeaponProfile } from '../src/sdk/weapons/thrownProfile';
import { SWORD_WOOD } from '../src/game/weapons/starterMeleeProfile';
import { parse } from 'valibot';
import { ThrownWeaponProfileSchema } from '../src/format/weaponProfiles';
import { hashImmutableBytes } from '../src/sdk/immutable';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };

test('the complete shared melee base retains original order, rich poses and detached ownership', () => {
  const before = JSON.stringify(SWORD_WOOD), owned = sharedMeleeAuthorBase(), second = sharedMeleeAuthorBase();
  expect(owned).toEqual(SWORD_WOOD); expect(JSON.stringify(owned)).toBe(before);
  expect(owned).not.toBe(SWORD_WOOD); expect(owned.feel).not.toBe(SWORD_WOOD.feel);
  expect(owned.sweep.extensions).not.toBe(SWORD_WOOD.sweep.extensions);
  const moves = owned.moves, native = SWORD_WOOD.moves;
  if (moves === undefined || native === undefined) throw new Error('Missing original shared moves');
  const keys = [moves.rest, moves.charge, moves.sprint, ...moves.combo.flatMap(row => row.keys), ...moves.heavy.keys];
  const nativeKeys = [native.rest, native.charge, native.sprint, ...native.combo.flatMap(row => row.keys), ...native.heavy.keys];
  for (const [index, key] of keys.entries()) {
    expect(key.pos).toBeInstanceOf(Vector3); expect(key.q).toBeInstanceOf(Quaternion);
    expect(key.pos).not.toBe(nativeKeys[index]?.pos); expect(key.q).not.toBe(nativeKeys[index]?.q);
  }
  for (const row of [...moves.combo, moves.heavy]) expect(row.trail.color).toBeInstanceOf(Color);
  moves.rest.pos.set(99, 98, 97); moves.rest.q.identity(); moves.heavy.trail.color.setRGB(0.1, 0.2, 0.3);
  owned.feel.lag.gain += 1;
  expect(JSON.stringify(SWORD_WOOD)).toBe(before); expect(JSON.stringify(second)).toBe(before);
});

test('the thrown author parser retains the complete native item policy and refusal boundary', () => {
  const input = items.rows.find(row => row.id === 'weapon.spear')?.profile;
  expect(parseThrownWeaponProfile(input)).toEqual(parse(ThrownWeaponProfileSchema, input));
  for (const bad of [null, {}, { family: 'thrown' }, { family: 'thrown', flight: { gravity: Number.POSITIVE_INFINITY } }]) {
    expect(() => parseThrownWeaponProfile(bad)).toThrow();
    expect(() => parse(ThrownWeaponProfileSchema, bad)).toThrow();
  }
});

test('the actual shared author base is renderer-free in a fresh Node realm', () => {
  const source = `import {sharedMeleeAuthorBase} from './src/sdk/weapons/meleeProfile.ts';
    import {hashImmutableBytes} from './src/sdk/immutable.ts';const value=sharedMeleeAuthorBase();
    console.log(JSON.stringify({hash:hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value))),
      rich:value.moves.rest.pos.isVector3&&value.moves.rest.q.isQuaternion&&value.moves.heavy.trail.color.isColor}));`;
  const output = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(output)).toEqual({ hash: hashImmutableBytes(new TextEncoder().encode(JSON.stringify(SWORD_WOOD))), rich: true });
});
