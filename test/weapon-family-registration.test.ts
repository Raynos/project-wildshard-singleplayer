import { expect, it } from 'vitest';
import { registerWeaponFamily } from '../src/game/plugin/weaponFamily';
import { shardItemFamilies } from '../src/game/shardfile/items';
import type { ItemFamily } from '../src/engine/combat/itemFamilies';

it('keeps trusted family registration local and lazy, preserving the exact native factory object', () => {
  let allocations = 0;
  const family: ItemFamily = { kind: 'weapon', create: () => { allocations++; throw new Error('Only the item installer constructs weapons'); } };
  const first = new Map<string, ItemFamily>(), second = new Map<string, ItemFamily>();
  registerWeaponFamily(first, 'sunscar-dunes.whip', family); registerWeaponFamily(second, 'sunscar-dunes.whip', family);
  expect(allocations).toBe(0); expect(first.get('sunscar-dunes.whip')).toBe(family);
  expect(shardItemFamilies(new Map(), { slug: 'sunscar-dunes', families: first }).get('sunscar-dunes.whip')).toBe(family);
  first.clear(); expect(second.get('sunscar-dunes.whip')).toBe(family);
});
it('refuses duplicate, malformed, reserved and non-weapon registration before any constructor runs', () => {
  const map = new Map<string, ItemFamily>();
  const family: ItemFamily = { kind: 'weapon', create: () => { throw new Error('Constructor must not run'); } };
  registerWeaponFamily(map, 'far-reach.fan', family);
  expect(() => registerWeaponFamily(map, 'far-reach.fan', family)).toThrow('Duplicate');
  for (const id of ['fan', 'kit.fan', ' bad.fan', `far-reach.${'x'.repeat(128)}`])
    expect(() => registerWeaponFamily(map, id, family)).toThrow('bounded shard-local');
  expect(() => registerWeaponFamily(map, 'far-reach.tool', { kind: 'tool', create: () => { throw new Error('No construction'); } })).toThrow('weapon constructor');
  expect(() => shardItemFamilies(new Map(), { slug: 'sunscar-dunes', families: map })).toThrow('must be named');
  expect(() => shardItemFamilies(new Map(map), { slug: 'far-reach', families: map })).toThrow('shadows');
  expect([...map.keys()]).toEqual(['far-reach.fan']);
});
