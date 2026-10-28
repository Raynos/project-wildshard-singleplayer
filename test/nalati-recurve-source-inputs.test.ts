import { expect, test } from 'vitest';
import { recurveBase, recurvePool } from '../src/shards/nalati-grasslands/generators/recurvePool';
import { BOW } from '../src/game/weapons/starterBowProfile';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseBowProfile } from '../src/sdk/weapons/bowProfile';
import { HeldBowBaseSchema } from '../src/format/weaponProfiles';
import { parse } from 'valibot';
import policy from '../src/shards/nalati-grasslands/data/recurvePolicy.json' with { type: 'json' };
import original from './fixtures/nalati-recurve-source-original.json' with { type: 'json' };

test('recurve author policy retains original native tuning without the wind strategy', () => {
  const { wind, ...native } = BOW; void wind;
  expect(policy).toEqual(native);
  expect(recurveBase()).toEqual(original.rows.base);
  expect(Object.keys(recurveBase())).toEqual(Object.keys(original.rows.base));
  expect(parse(HeldBowBaseSchema, recurveBase())).toEqual(original.rows.base);
  expect(() => parseBowProfile({ family: 'bow' })).toThrow();
});

test('the full recurve pool and every emitted row retain their original bytes', () => {
  const current = recurvePool();
  expect(current.rows).toEqual(original.rows);
  expect(JSON.stringify(current.rows)).toBe(JSON.stringify(original.rows));
  expect(current.glb.length).toBe(original.bytes);
  expect(hashImmutableBytes(current.glb)).toBe(original.sha256);
});
