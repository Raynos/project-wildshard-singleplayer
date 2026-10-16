import { expect, test } from 'vitest';
import { parseItems } from '../src/format/items';
import { leverSettings } from '../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { crossbowProfile } from '../src/shards/pine-hollow/weapons/crossbow/profiles';
import { LEVER_PROFILE } from './fixtures/weapon-oracle/leverBridge';
import { CROSSBOW_PROFILE } from './fixtures/weapon-oracle/crossbowProfile';
import { LEVER_PRESENTATION } from '../src/shards/pine-hollow/runtime/items/leverPresentation';
import ITEMS from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };

const items = parseItems(ITEMS);
function profile(id: string): unknown {
  const row = items.rows.find(item => item.id === id);
  if (row?.kind !== 'weapon' || row.profile === undefined) throw new Error('Missing shipping firearm');
  return row.profile;
}
test('both page constructors take the exact old profile numbers from admitted combat/items', () => {
  expect(crossbowProfile(profile('weapon.crossbow'))).toEqual(CROSSBOW_PROFILE);
  const lever = leverSettings(profile('weapon.lever'));
  expect(lever.profile).toEqual(LEVER_PROFILE);
  expect(lever.view).toEqual({ ...LEVER_PRESENTATION, magazine: 7, reserve: 21,
    timing: { autoReloadDelay: 0.35, autoReloadClose: 5, reloadIn: 0.22, reloadOut: 0.2, roundTime: 0.4 } });
});
test('absent or unsupported construction profiles refuse instead of allocating a fallback', () => {
  for (const input of [undefined, {}, profile('weapon.lever')]) expect(() => crossbowProfile(input)).toThrow();
  for (const input of [undefined, {}, profile('weapon.crossbow')]) expect(() => leverSettings(input)).toThrow();
});
