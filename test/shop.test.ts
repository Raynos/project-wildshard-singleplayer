// E314 stage 2 (src/game/loot/shop.ts): the trader's goods, their prices against the island's one full clear, buying, and
// the effects' numbers; the sea chart's marks; FINDS' places and the map's PLACES tally read the one list.
import { describe, expect, it } from 'vitest';
import { FULL_CLEAR, GOODS, buyGood, goodState, goodsTotal, maxHealthOf, swordMul } from '../src/game/loot/shop';
import { Owned, OWNED } from '../src/game/loot/Owned';
import { Purse } from '../src/game/loot/Purse';
import { driftwoodFinds, seaChartMarks } from '../src/game/loot/finds';
import { nearScale } from '../src/game/loot/CoinBurst';
import { DRIFTWOOD_PLACES } from '../src/game/quest/Places';
import { SEA_GLASS_COUNT } from '../src/world/interact/driftwood';

const SHARD = 'chunk://local/shop-test';
const flags = (set: string[]): { has: (f: string) => boolean } => ({ has: (f) => set.includes(f) });
const price = (id: string): number => GOODS.find((g) => g.id === id)?.price ?? Number.NaN;

describe('the goods', () => {
  it('six, in the shop order, no fin, every id a known Owned id', () => {
    expect(GOODS.map((g) => g.id)).toEqual(['whetstone-1', 'whetstone-2', 'heart-1', 'heart-2', 'sea-chart', 'cape']);
    for (const g of GOODS) expect(Object.hasOwn(OWNED, g.id)).toBe(true);
  });

  it('buying all of them takes about one full clear (95–100 %); the IIs dearest, the cape cheapest', () => {
    const t = goodsTotal();
    expect(t).toBeGreaterThanOrEqual(FULL_CLEAR * 0.95);
    expect(t).toBeLessThanOrEqual(FULL_CLEAR);
    const dearest = Math.max(...GOODS.map((g) => g.price)), cheapest = Math.min(...GOODS.map((g) => g.price));
    expect(price('whetstone-2')).toBe(dearest);
    expect(price('heart-2')).toBe(dearest);
    expect(price('cape')).toBe(cheapest);
    expect(price('whetstone-2')).toBeGreaterThan(price('whetstone-1'));
    expect(price('heart-2')).toBeGreaterThan(price('heart-1'));
  });
});

describe('buying', () => {
  it('states: buy · short · locked (a II before its I) · owned', () => {
    const owned = new Owned(SHARD);
    const [w1, w2] = GOODS;
    if (!w1 || !w2) throw new Error('goods');
    expect(goodState(w1, owned, 100)).toBe('buy');
    expect(goodState(w1, owned, 1)).toBe('short');
    expect(goodState(w2, owned, 100)).toBe('locked');
    owned.grant('whetstone-1');
    expect(goodState(w1, owned, 100)).toBe('owned');
    expect(goodState(w2, owned, 100)).toBe('buy');
  });

  it('a sale spends the price and grants the good once; a refused one changes nothing', () => {
    const owned = new Owned(`${SHARD}/2`), purse = new Purse(`${SHARD}/2`);
    const heart1 = GOODS.find((g) => g.id === 'heart-1'), heart2 = GOODS.find((g) => g.id === 'heart-2');
    if (!heart1 || !heart2) throw new Error('goods');
    purse.add(heart1.price + 3);
    expect(buyGood(heart2, owned, purse)).toBe(false);          // locked
    expect(buyGood(heart1, owned, purse)).toBe(true);
    expect(purse.coins).toBe(3);
    expect(owned.has('heart-1')).toBe(true);
    expect(buyGood(heart1, owned, purse)).toBe(false);          // owned
    expect(buyGood(heart2, owned, purse)).toBe(false);          // short
    expect(purse.coins).toBe(3);
  });

  it('every good bought with exactly the goods total leaves the purse at 0', () => {
    const owned = new Owned(`${SHARD}/3`), purse = new Purse(`${SHARD}/3`);
    purse.add(goodsTotal());
    for (const g of GOODS) expect(buyGood(g, owned, purse)).toBe(true);
    expect(purse.coins).toBe(0);
  });
});

describe('effects', () => {
  it('whetstones: ×1 · ×1.25 · ×1.5 (wood 12 → 15 → 18, iron 28 → 35 → 42)', () => {
    expect([0, 1, 2].map((n) => Math.round(12 * swordMul(n)))).toEqual([12, 15, 18]);
    expect([0, 1, 2].map((n) => Math.round(28 * swordMul(n)))).toEqual([28, 35, 42]);
  });

  it('max health 100 · 120 · 140, +10 with the first charm', () => {
    expect(maxHealthOf(flags([]))).toBe(100);
    expect(maxHealthOf(flags(['heart-1']))).toBe(120);
    expect(maxHealthOf(flags(['heart-1', 'heart-2']))).toBe(140);
    expect(maxHealthOf(flags(['heart-1', 'heart-2', 'charm-1']))).toBe(150);
  });

  it('the sea chart marks every unfound piece; a found one is gone', () => {
    expect(seaChartMarks(flags([]))).toHaveLength(SEA_GLASS_COUNT);
    const some = seaChartMarks(flags(['glass:1', 'glass:7']));
    expect(some).toHaveLength(SEA_GLASS_COUNT - 2);
    expect(some.some((m) => m.x === -20 && m.z === -146)).toBe(false);  // glass:1
    const all = Array.from({ length: SEA_GLASS_COUNT }, (_, i) => `glass:${i + 1}`);
    expect(seaChartMarks(flags(all))).toEqual([]);
  });

  it('coins shrink to a speck as they reach the lens', () => {
    expect(nearScale(6)).toBe(1);
    expect(nearScale(2)).toBeLessThan(0.3);
    expect(nearScale(1)).toBeCloseTo(0.12);
    for (let d = 1; d < 5; d += 0.25) expect(nearScale(d + 0.25)).toBeGreaterThanOrEqual(nearScale(d));
  });
});

describe('places: FINDS and the map tally agree', () => {
  it('FINDS counts DRIFTWOOD_PLACES (the map pins are the same list, Places.ts installPlaces)', () => {
    const f = driftwoodFinds(flags(['seen:pier', 'seen:hut']), flags([]));
    const places = f.counters.find((c) => c.label === 'Places');
    expect(places).toEqual({ label: 'Places', n: 2, of: DRIFTWOOD_PLACES.length });
    expect(DRIFTWOOD_PLACES).toHaveLength(9);
  });
});
