import { beforeAll, expect, test } from 'vitest';
import ORIGINAL from './fixtures/pine-trade-catalogue.json' with { type: 'json' };
import { readProjectAssets } from '../src/sdk/project';
import { parseTradeCatalogue, PineTrader, type TradeCatalogue } from '../src/shards/pine-hollow/runtime/trader';
import { mottLine, tradeCost, tradeState } from '../src/shards/pine-hollow/quest/trades';

let declared: TradeCatalogue | undefined;
beforeAll(async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const named = loaded.output.namedFiles?.find(file => file.name === 'quests/trades.json');
  const bytes = named === undefined ? undefined : loaded.assets.get(named.hash);
  if (bytes === undefined) throw new Error('Missing emitted barter catalogue');
  declared = parseTradeCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}, 30_000);
function catalogue(): TradeCatalogue {
  if (declared === undefined) throw new Error('The emitted catalogue is required');
  return declared;
}

test('the named catalogue preserves every original offer, panel tile, cost noun and Bag line', () => {
  const rows = catalogue();
  expect(rows).toEqual(ORIGINAL);
  for (const [id, text] of Object.entries(ORIGINAL.lines)) expect(mottLine(rows, id)).toBe(text);
  expect(mottLine(rows, 'unkept')).toBe('Mott has no use for it');
  for (const good of rows.goods) for (const have of [0, 1, 3, 10]) {
    expect(tradeCost(good, { count: () => have })).toEqual(good.cost.map(cost => ({ text: `${cost.text} (${have})`, have: have >= cost.n })));
  }
});

test('an old open shop resumes silently and pays/grants each original offer in order', () => {
  const rows = catalogue();
  for (const [index, good] of rows.goods.entries()) {
    const events: string[] = [], pack = { count: () => 99, take: (id: string, n: number) => { events.push(`take:${id}:${n}`); return true; } };
    const shop = new PineTrader({ catalogue: rows, pack, owns: () => false, room: () => true,
      addBolts: n => { events.push(`bolts:${n}`); }, addAmmo: (kind, n) => { events.push(`ammo:${kind}:${n}`); }, ownSkin: id => { events.push(`skin:${id}`); } });
    expect(shop.use(index)).toBe(false);
    shop.restore({ version: 1, open: true }); expect(events).toEqual([]);
    expect(shop.use(index)).toBe(true);
    const got = good.trade.get;
    expect(events).toEqual([...good.trade.give.map(cost => `take:${cost.item}:${cost.n}`),
      'bolts' in got ? `bolts:${got.bolts}` : 'ammo' in got ? `ammo:${got.ammo}:${got.n}` : `skin:${got.skin}`]);
    const before = shop.snapshot();
    expect(() => shop.restore({ version: 2, open: false })).toThrow(); expect(shop.snapshot()).toEqual(before);
    expect(shop.use(-1)).toBe(false); expect(shop.snapshot()).toEqual({ version: 1, open: false });
    expect(tradeState(good.trade, { count: () => 0 }, () => false).ok).toBe(false);
    expect(tradeState(good.trade, pack, () => false, () => false).full).toBe(!('skin' in got));
    expect(tradeState(good.trade, pack, () => true).owned).toBe(good.trade.once === true && 'skin' in got);
  }
});

test('catalogue admission refuses incomplete words, duplicate identities and mismatched payment displays', () => {
  const rows = catalogue(), first = rows.goods[0];
  if (first === undefined) throw new Error('The original catalogue has seven goods');
  expect(() => parseTradeCatalogue({ ...rows, lines: {} })).toThrow();
  expect(() => parseTradeCatalogue({ ...rows, goods: [first, first] })).toThrow();
  expect(() => parseTradeCatalogue({ ...rows, goods: [{ ...first, cost: [] }] })).toThrow();
  expect(() => parseTradeCatalogue({ ...rows, goods: [{ ...first, cost: [{ item: 'venison', n: 100, text: 'Wrong payment' }] }] })).toThrow();
  expect(() => parseTradeCatalogue({ ...rows, goods: [{ ...first, trade: { ...first.trade, give: Array.from({ length: 4 }, () => ({ item: 'venison', n: 1 })) } }] })).toThrow();
});
