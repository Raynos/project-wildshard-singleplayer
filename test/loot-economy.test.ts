import { expect, test } from 'vitest';
import { createFindsCatalogue } from '../src/game/bag/findsCatalogue';
import { DRIFTWOOD_FINDS } from '../src/shards/driftwood-isle/generators/finds';
import { parseLootEconomy } from '../src/format/lootEconomy';
import { parseRows } from '../src/format/rows';
import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import { Exchange } from '../src/game/loot/exchange';
import { driftwoodLootPresentation } from '../src/shards/driftwood-isle/loot/presentation';
import { Flags } from '../src/engine/world/interact/flags';
import { Scope } from '../src/engine/app/scope';
import { Owned, type OwnedId } from '../src/game/loot/Owned';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/generators/interactables';

const rows = () => parseRows({ strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [LOOT] }).loot;
const economy = declaredLootEconomy(rows());

test('emitted goods keep prices, prerequisites and spend-before-grant transaction order', () => {
  expect(economy.goods.map(good => [good.id, good.price, good.needs ?? null])).toEqual([
    ['whetstone-1', 12, null], ['whetstone-2', 22, 'whetstone-1'], ['heart-1', 14, null],
    ['heart-2', 22, 'heart-1'], ['sea-chart', 12, null], ['cape', 8, null],
  ]);
  for (const good of economy.goods) {
    const have = new Set<OwnedId>(), calls: string[] = [], owned = { has: (id: OwnedId) => have.has(id), grant: (id: OwnedId) => { calls.push(`grant:${id}`); have.add(id); return true; } };
    const purse = { coins: good.price, spend: (n: number) => { calls.push(`spend:${n}`); purse.coins -= n; return true; } };
    const shop = new Exchange(economy.exchange, new Map<string, unknown>([['owned', owned], ['purse', { count: () => purse.coins, spend: purse.spend }]]));
    const index = economy.goods.indexOf(good); shop.open();
    if (good.needs !== undefined) { expect(shop.state(index)).toBe('locked'); expect(shop.use(index)).toBe(false); have.add(good.needs); }
    purse.coins = good.price - 1; expect(shop.state(index)).toBe('short'); expect(shop.use(index)).toBe(false); expect(calls).toEqual([]);
    purse.coins = good.price; expect(shop.use(index)).toBe(true); expect(calls).toEqual([`spend:${good.price}`, `grant:${good.id}`]); expect(purse.coins).toBe(0);
    expect(shop.state(index)).toBe('owned'); expect(shop.use(index)).toBe(false);
  }
});

test('a refused purse debit never grants a good or changes modal ownership', () => {
  const calls: string[] = [];
  const shop = new Exchange(economy.exchange, new Map<string, unknown>([
    ['owned', { has: () => false, grant: () => { calls.push('grant'); } }],
    ['purse', { count: () => 100, spend: () => { calls.push('spend'); return false; } }],
  ]));
  shop.open();
  expect(shop.use(0)).toBe(false);
  expect(calls).toEqual(['spend']);
  expect(shop.snapshot()).toEqual({ version: 1, open: true });
});

test('chart rows preserve all shipping world positions, order and saved-flag visibility', async () => {
  const old = DRIFTWOOD_INTERACT.rows.flatMap(row => row.kind === 'pickup' && row.look === 'seaglass' && row.at.poi === 'world' && row.sets?.[0] !== undefined
    ? [{ flag: row.sets[0], x: row.at.x, z: row.at.z, color: row.color ?? '#7df0d0' }] : []);
  expect(economy.marks).toEqual(old); expect(old).toHaveLength(15);
  const saved = new Set(old.filter((_, index) => index % 2 === 0).map(row => row.flag));
  const flags = new Flags('driftwood-isle', false), scope = new Scope('loot-chart'); flags.restore([...saved]);
  try {
    const view = await driftwoodLootPresentation({ economy, adventure: { flags }, owned: new Owned('driftwood-isle'),
      health: { attributes: { maxHealth: 100 } }, audio: { voices: { play: () => undefined } } });
    expect(view.marks?.()).toEqual(old.filter(row => !saved.has(row.flag)).map(({ x, z, color }) => ({ x, z, color })));
  } finally { scope.dispose(); }
});

test('economy rejects executable, malformed and unresolved rows before reading live state', () => {
  expect(() => declaredLootEconomy([])).toThrow('Exactly one');
  const getter = { ...LOOT.economy }; let read = 0;
  Object.defineProperty(getter, 'effects', { enumerable: true, get: () => { read++; return []; } });
  expect(() => parseLootEconomy(getter)).toThrow('JSON-only'); expect(read).toBe(0);
  for (const change of [
    { goods: [{ ...economy.goods[0], price: Infinity }] },
    { goods: [{ ...economy.goods[0], needs: 'missing' }] },
    { grants: { ...economy.grants, player: [{ id: 'effect.missing', key: 'heart-1' }] } },
    { finds: { ...economy.finds, next: { counter: 31, every: 5, max: 15, text: 'Next' } } },
    { goods: [{ ...economy.goods[0], purchase: () => undefined }] },
  ]) expect(() => parseLootEconomy({ ...LOOT.economy, ...change })).toThrow();
  const unknown = rows();
  const payload = unknown[0]?.economy;
  if (payload === undefined) throw new Error('Missing fixture payload');
  payload.goods[payload.goods.length - 1] = { id: 'not-owned', name: 'Missing', does: '', icon: 'heart', price: 1 };
  expect(() => declaredLootEconomy(unknown)).toThrow('Unknown economy ownership');
});

test('emitted finds observe old saved flag and ownership progress identically', () => {
  const before = createFindsCatalogue(DRIFTWOOD_FINDS), after = createFindsCatalogue(economy.finds);
  for (let n = 0; n <= 15; n++) {
    const ports = { flags: { has: (flag: string) => flag.startsWith('glass:') ? Number(flag.slice(6)) <= n : n % 2 === 0 },
      owned: { has: (_id: OwnedId) => n % 3 === 0 } };
    expect(after(ports)).toEqual(before(ports));
  }
});
