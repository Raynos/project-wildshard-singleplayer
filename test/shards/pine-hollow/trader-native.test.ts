import { expect, it } from 'vitest';
import { createPinePack } from '../../../src/shards/pine-hollow/runtime/pack';
import { PineTrader, PINE_TRADE_CLOSE } from '../../../src/shards/pine-hollow/runtime/trader';
import { TRADES, tradeState } from '../../../src/shards/pine-hollow/quest/trades';
import type { AmmoKind } from '../../../src/shards/pine-hollow/loadout/ammo';

function setup() {
  const pack = createPinePack(), owned = new Set<string>(), effects: unknown[] = [];
  const ammo: Record<AmmoKind, number> = { iron: 0, pitch: 0, broadhead: 0, cartridge: 0, arrow: 0 };
  const room = (kind: AmmoKind, n: number): boolean => kind === 'cartridge' || ammo[kind] + n <= (kind === 'arrow' ? 20 : 30);
  const trader = new PineTrader({ pack: { count: pack.count, take: (id, n) => { effects.push(['take', id, n]); return pack.take(id, n); } },
    owns: skin => owned.has(skin), room, addBolts: n => { effects.push(['ammo', 'iron', n]); ammo.iron += n; },
    addAmmo: (kind, n) => { effects.push(['ammo', kind, n]); ammo[kind] += n; },
    ownSkin: skin => { effects.push(['skin', skin]); owned.add(skin); } });
  return { trader, pack, owned, ammo, effects, room };
}

it('runs every authored Mott swap with the page check and exact take-before-grant order', () => {
  for (const [i, trade] of TRADES.entries()) {
    const { trader, pack, owned, effects, room } = setup();
    for (const give of trade.give) pack.add(give.item, give.n);
    expect(trader.use(i)).toBe(false); expect(effects).toEqual([]);
    trader.open();
    expect(tradeState(trade, pack, skin => owned.has(skin), room).ok).toBe(true);
    expect(trader.use(i)).toBe(true);
    const got = trade.get;
    expect(effects).toEqual([...trade.give.map(give => ['take', give.item, give.n]),
      'bolts' in got ? ['ammo', 'iron', got.bolts] : 'ammo' in got ? ['ammo', got.ammo, got.n] : ['skin', got.skin]]);
    for (const give of trade.give) expect(pack.count(give.item)).toBe(0);
    if ('skin' in got) {
      for (const give of trade.give) pack.add(give.item, give.n);
      const before = structuredClone(effects);
      expect(trader.use(i)).toBe(false); expect(effects).toEqual(before);
    }
  }
});

it('rejects full ammunition stacks and short packs without charging, and closes only explicitly', () => {
  const { trader, pack, ammo, effects } = setup(); trader.open();
  pack.add('deer-hide', 2); ammo.iron = 21;
  expect(trader.use(0)).toBe(false); expect(pack.count('deer-hide')).toBe(2); expect(effects).toEqual([]);
  ammo.iron = 20; expect(trader.use(0)).toBe(true); expect(ammo.iron).toBe(30);
  for (const value of [0, 0.5, -2, 7, Number.NaN, Number.POSITIVE_INFINITY]) expect(trader.use(value)).toBe(false);
  expect(trader.active).toBe(true);
  trader.use(PINE_TRADE_CLOSE); expect(trader.active).toBe(false);
});

it('silently restores the modal and rejects malformed continuation before changing it', () => {
  const { trader, effects } = setup(); trader.open(); const saved = trader.snapshot();
  trader.use(PINE_TRADE_CLOSE); trader.restore(saved); expect(trader.snapshot()).toEqual(saved); expect(effects).toEqual([]);
  for (const bad of [{ ...saved, version: 2 }, { ...saved, open: 1 }, { ...saved, extra: 1 }, null]) {
    expect(() => trader.restore(bad)).toThrow(); expect(trader.snapshot()).toEqual(saved); expect(effects).toEqual([]);
  }
});

it('preserves the page plain-bolt callback even when the crossbow currently holds special ammunition', () => {
  const pack = createPinePack(); pack.add('deer-hide', 2);
  let iron = 20, pitch = 7;
  const trader = new PineTrader({ pack, owns: () => false, room: (kind, n) => kind === 'iron' && iron + n <= 30,
    addBolts: n => { pitch = Math.min(30, pitch + n); }, addAmmo: () => { iron++; }, ownSkin: () => undefined });
  trader.open(); expect(trader.use(0)).toBe(true); expect(iron).toBe(20); expect(pitch).toBe(17);
});
