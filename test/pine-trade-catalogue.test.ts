import { beforeAll, expect, test } from 'vitest';
import ORIGINAL from './fixtures/pine-trade-catalogue.json' with { type: 'json' };
import { readProjectAssets } from '../src/sdk/project';
import { parseTradeCatalogue, type TradeCatalogue } from '../src/shards/pine-hollow/generators/sections';
import { Exchange, parseExchange } from '../src/game/loot/exchange';
import type { ExchangeRows } from '../src/format/exchange';
import { parseBarterEconomy, type BarterEconomy } from '../src/format/lootEconomy';
import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import { tradeCatalogue } from '../src/shards/pine-hollow/generators/trades';
import { pinePickups } from '../src/shards/pine-hollow/generators/pickups';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { readLootTables, registerLootTable, rollLoot } from '../src/game/loot/tables';

let declared: TradeCatalogue | undefined;
let exchangeRows: ExchangeRows | undefined;
let economy: BarterEconomy | undefined;
beforeAll(async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  economy = declaredLootEconomy(loaded.shard.rows.loot, 'barter');
  expect(loaded.output.custom?.sections.some(row => row.name === 'custom/tradeCatalogue')).toBe(false);
  const exchange = loaded.output.namedFiles?.find(file => file.name === 'quests/exchange.json');
  const exchangeBytes = exchange === undefined ? undefined : loaded.assets.get(exchange.hash);
  if (exchangeBytes === undefined) throw new Error('Missing emitted exchange');
  expect(economy.exchange).toEqual(parseExchange(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(exchangeBytes))));
  exchangeRows = economy.exchange;
  declared = parseTradeCatalogue(tradeCatalogue());
}, 30_000);
function catalogue(): TradeCatalogue {
  if (declared === undefined) throw new Error('The emitted catalogue is required');
  return declared;
}

test('the named catalogue preserves every original offer, panel tile, cost noun and Bag line', () => {
  const rows = catalogue();
  expect(rows).toEqual(ORIGINAL);
  expect(economy?.goods).toEqual(ORIGINAL.goods.map(({ id, name, does, icon, price, tile }) => ({ id, name, does, icon, price, tile })));
  for (const [id, text] of Object.entries(ORIGINAL.lines)) expect(rows.lines[id]).toBe(text);
  expect(rows.lines['unkept'] ?? 'Mott has no use for it').toBe('Mott has no use for it');
  for (const good of rows.goods) for (const have of [0, 1, 3, 10]) {
    expect(new Exchange(exchangeRows, new Map<string, unknown>([['pack', { count: () => have, take: () => true }], ['skins', { owns: () => false, own: () => undefined }], ['ammo', { capacity: () => true, grant: () => undefined, addBolts: () => undefined }]])).cost(rows.goods.indexOf(good))).toEqual(good.cost.map(cost => ({ text: `${cost.text} (${have})`, have: have >= cost.n })));
  }
});

test('barter admission aligns cards and transactions and scoped drop tables retain pickup candidates', () => {
  if (economy === undefined) throw new Error('Missing product economy');
  const admitted = economy;
  expect(() => parseBarterEconomy({ ...admitted, goods: admitted.goods.slice(1) })).toThrow();
  expect(() => parseBarterEconomy({ ...admitted, goods: admitted.goods.slice().reverse() })).toThrow();
  const scope = new Scope('pine.economy'), previous = app.levelScope;
  try {
    app.levelScope = scope;
    for (const table of readLootTables(economy.tables)) registerLootTable(table, scope);
    const pickups = Object.entries(pinePickups());
    for (const kind of ['deer', 'boar', 'elk', 'bear', 'antler-king', 'unknown']) for (const variant of [undefined, 'ghost', 'ironhide', 'blackpaw', 'imperial']) {
      const expected = pickups.filter(([, row]) => row.death?.kind === kind && (row.death.variant === undefined || row.death.variant === variant)).map(([id]) => id);
      expect(rollLoot('finish-drops', { kind, variant }, () => { throw new Error('Fixed drops must not draw RNG'); }).map(drop => drop.item)).toEqual(expected);
    }
    scope.dispose(); expect(rollLoot('finish-drops', { kind: 'deer', variant: 'ghost' })).toEqual([]);
  } finally { scope.dispose(); app.levelScope = previous; }
});

test('an old open shop resumes silently and pays/grants each original offer in order', () => {
  const rows = catalogue();
  for (const [index, good] of rows.goods.entries()) {
    const events: string[] = []; let held = 99;
    const pack = { count: () => held, take: (id: string, n: number) => { events.push(`take:${id}:${n}`); return true; } };
    let owned = false, room = true;
    const shop = new Exchange(exchangeRows, new Map<string, unknown>([['pack', pack], ['skins', { owns: () => owned, own: (id: string) => { events.push(`skin:${id}`); } }],
      ['ammo', { capacity: () => room, addBolts: (n: number) => { events.push(`bolts:${n}`); }, grant: (kind: string, n: number) => { events.push(`ammo:${kind}:${n}`); } }]]));
    expect(shop.use(index)).toBe(false);
    shop.restore({ version: 1, open: true }); expect(events).toEqual([]);
    expect(shop.use(index)).toBe(true);
    const got = good.trade.get;
    expect(events).toEqual([...good.trade.give.map(cost => `take:${cost.item}:${cost.n}`),
      'bolts' in got ? `bolts:${got.bolts}` : 'ammo' in got ? `ammo:${got.ammo}:${got.n}` : `skin:${got.skin}`]);
    const before = shop.snapshot();
    expect(() => shop.restore({ version: 2, open: false })).toThrow(); expect(shop.snapshot()).toEqual(before);
    expect(shop.use(-1)).toBe(false); expect(shop.snapshot()).toEqual({ version: 1, open: false });
    expect(shop.check(index).ok).toBe(true);
    held = 0;
    expect(shop.check(index).ok).toBe(false); held = 99;
    room = false; expect(shop.check(index).full).toBe(!('skin' in got));
    owned = true; expect(shop.check(index).owned).toBe(good.trade.once === true && 'skin' in got);
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
