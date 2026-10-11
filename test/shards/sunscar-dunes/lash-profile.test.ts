import { expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import { lashSpec } from '../../../src/shards/sunscar-dunes/runtime/items/lash';
import { bindSignalItems } from '../../../src/shards/sunscar-dunes/runtime/items';
import { CRACK } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { WHIP_ITEM, WHIP_PROFILE } from '../../../src/shards/sunscar-dunes/data/items';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import source from '../../../src/shards/sunscar-dunes/shard.config';

it('consumes the admitted lash profile through its real family, retaining the legacy held slot and shipping crack', () => {
  const app = new App();
  try {
    let built = 0;
    const whip = bindSignalItems({ app, scope: app.engineScope, game: { shard: manifest, rows: new Map(), bag: new TabRegistry() } },
      { raycast: () => null }, () => { built++; });
    expect(built).toBe(1);
    expect(whip.row.legacySlot).toBe('sunscar-whip');
    expect(whip.row.id).toBe(WHIP_ITEM.id);
    const row = source.items.rows.find(item => item.id === WHIP_ITEM.id);
    if (row === undefined) throw new Error('Missing declared lash');
    expect(row.kind === 'weapon' ? row.profile : null).toEqual(WHIP_PROFILE);
    expect(lashSpec(row, WHIP_PROFILE)).toEqual(CRACK);
  } finally { app.engineScope.dispose(); }
});

it('derives damage and reach from the actual admitted item, and contacts from its profile rather than a native constant', () => {
  const profile = { ...WHIP_PROFILE, timing: { ...WHIP_PROFILE.timing, unroll: 0.08, second: 0.24 } };
  const row = { ...WHIP_ITEM, light: { ...WHIP_ITEM.light, damage: 7, range: 3 } };
  const spec = lashSpec(row, profile);
  expect([spec.light, spec.reach, spec.unroll, spec.second]).toEqual([7, 3, 0.08, 0.24]);
  expect(() => lashSpec(row, { ...profile, timing: { ...profile.timing, second: 0.08 } })).toThrow();
});
