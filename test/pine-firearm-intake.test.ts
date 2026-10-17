import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import tuning from '../src/shards/pine-hollow/data/heldTuning.json' with {type:'json'};
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { parseItems } from '../src/format/items';
import { heldFirearmSettings, heldLauncherProfile } from '../src/game/plugin/heldEquipment';
import { LEVER_PROFILE } from './fixtures/weapon-oracle/leverBridge';
import { CROSSBOW_PROFILE } from './fixtures/weapon-oracle/crossbowProfile';
import LEVER_DETAILS from '../src/shards/pine-hollow/data/leverDetails.json' with { type: 'json' };
import ITEMS from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };

const items = parseItems(ITEMS), view = v.parse(HeldEquipmentSchema.entries.firearm.entries.rows.entries.view, LEVER_DETAILS.rows.view);
function profile(id: string): unknown {
  const row = items.rows.find(item => item.id === id);
  if (row?.kind !== 'weapon' || row.profile === undefined) throw new Error('Missing shipping firearm');
  return row.profile;
}
test('both page constructors take the exact old profile numbers from admitted combat/items', () => {
  expect(heldLauncherProfile(profile('weapon.crossbow'),tuning.launcherTuning)).toEqual(CROSSBOW_PROFILE);
  const lever = heldFirearmSettings(profile('weapon.lever'), view,tuning.firearmTuning);
  expect(lever.profile).toEqual(LEVER_PROFILE);
  expect(lever.view).toEqual({ ...view, magazine: 7, reserve: 21,
    timing: { autoReloadDelay: 0.35, autoReloadClose: 5, reloadIn: 0.22, reloadOut: 0.2, roundTime: 0.4 } });
});
test('absent or unsupported construction profiles refuse instead of allocating a fallback', () => {
  for (const input of [undefined, {}, profile('weapon.lever')]) expect(() => heldLauncherProfile(input,tuning.launcherTuning)).toThrow();
  for (const input of [undefined, {}, profile('weapon.crossbow')]) expect(() => heldFirearmSettings(input, view,tuning.firearmTuning)).toThrow();
});
