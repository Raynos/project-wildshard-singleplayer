import { expect, it } from 'vitest';
import { BowDraw, DEFAULT_BOW_DRAW } from '../src/engine/combat/bowDraw';
import { BowDraw as ShippingDraw } from './fixtures/weapon-oracle/bowDraw';
import { parseItems } from '@wildshard/format/items';
import { PINE_ITEMS } from '../src/shards/pine-hollow/data/items';
import { NALATI_ITEMS } from '../src/shards/nalati-grasslands/data/items';
import { BOW_PROFILE as pine } from '../src/shards/pine-hollow/data/bowProfile';
import { BOW_PROFILE as nalati } from '../src/shards/nalati-grasslands/data/bowProfile';
import { LONGBOW } from '../src/shards/pine-hollow/weapons/longbowProfile';
import { NALATI_BOW } from '../src/shards/nalati-grasslands/weapons/loadout';

it('declares both actual native bows on the shared family and feeds their page clocks, loose and arrow numbers', () => {
  for (const [items, profile, view] of [[PINE_ITEMS, pine, LONGBOW], [NALATI_ITEMS, nalati, NALATI_BOW]] as const) {
    const row = parseItems(items).rows.find(item => item.kind === 'weapon' && item.family === 'bow');
    if (row?.kind !== 'weapon') throw new Error('Missing native bow row');
    expect(row.profile).toEqual(profile); expect(view.draw).toEqual(profile.draw);
    expect([view.quiver, view.speedBase, view.speedDraw, view.damageScale, view.aimSpread])
      .toEqual([profile.quiver, profile.speedBase, profile.speedDraw, profile.damageScale, profile.spread.aimMultiplier]);
    expect(view.loose).toEqual({ ...profile.spread, muzzle: profile.muzzle });
    expect(view.projectile).toEqual({ ...profile.flight, maxFlying: profile.pool, substeps: profile.substeps, lifetime: profile.lifetime });
  }
});

it('retains every shipping draw edge and state across 10k mixed held, blocked, mounted, reward and restored frames', () => {
  for (const profile of [pine.draw, nalati.draw]) {
    const actual = new BowDraw(profile), shipping = new ShippingDraw();
    expect(profile).toEqual(DEFAULT_BOW_DRAW);
    for (let tick = 0; tick < 10000; tick++) {
      const dt = [1 / 60, 1 / 30, 1 / 20][tick % 3]; if (dt === undefined) throw new Error('Missing sampled delta');
      const held = tick % 719 < 681, blocked = tick % 137 < 3, rate = tick % 2 === 0 ? 0.75 / 0.9 : 1.2;
      expect(actual.step(dt, held, blocked, rate)).toBe(shipping.step(dt, held, blocked, rate));
      expect(actual.save()).toEqual(shipping.save()); expect([actual.p, actual.sway, actual.full, actual.drawing]).toEqual([shipping.p, shipping.sway, shipping.full, shipping.drawing]);
      if (tick === 4217) { const resumed = new BowDraw(profile); resumed.load(actual.save()); actual.load(resumed.save()); shipping.load(shipping.save()); }
    }
  }
});

it('uses authored timing instead of native constants, snapshots its immutable parameters and refuses invalid clocks', () => {
  const row = { ...pine.draw, drawTime: 1.5 }, slow = new BowDraw(row), normal = new BowDraw(pine.draw);
  row.drawTime = 0.01;
  for (let tick = 0; tick < 50; tick++) { slow.step(1 / 60, true, false); normal.step(1 / 60, true, false); }
  expect(normal.step(1 / 60, false, false)).toBe('loose'); expect(slow.step(1 / 60, false, false)).toBe('letdown');
  for (const bad of [{ ...pine.draw, drawTime: 0 }, { ...pine.draw, holdTire: 2 }, { ...pine.draw, renockEarly: 1.1 }, { ...pine.draw, tiredTime: Infinity }]) {
    expect(() => new BowDraw(bad)).toThrow('Invalid bow draw profile');
  }
});
