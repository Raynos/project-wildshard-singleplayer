import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { parseClientPlan } from '../src/format/clientPlan';
import { CatalogueEconomySchema, type CatalogueEconomy } from '../src/format/catalogueEconomy';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateDefinedSection } from '../src/sdk/sections';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installClientCatalogue } from '../src/game/shardfile/clientCatalogue';
import type { ShardContext } from '../src/game/plugin/context';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import { HeldFinishes } from '../src/game/loadout/finishes';
import source from '../src/shards/pine-hollow/shard.config';
import { STARTER_EFFECTS } from '../src/game/plugin/ui';
import loot from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };
import { driftwoodCatalogueEconomy } from '../src/shards/driftwood-isle/generators/catalogueEconomy';
import { parseRows } from '../src/format/rows';
import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import { legacyDouble } from './fake/FakeGame';

const input = { kind: 'content.catalogue', quests: false, finishes: false,
  weapons: ['weapon.crossbow'], ammunition: ['weapon.crossbow'], effects: ['starter'], compendiums: [],
  encounters: [{ id: 'marsh.sentry', displayName: 'The Reed Sentry', showHeadBar: true }] };
function catalogue(value: unknown) {
  const [row] = parseClientPlan({ version: 1, features: [value] }).features;
  if (row?.kind !== 'content.catalogue') throw new Error('Missing admitted catalogue');
  return row;
}
function fixture(parent?: Scope) {
  const scope = parent?.child('marsh.catalogue') ?? new Scope('marsh.catalogue'), read = vi.fn(() => Promise.reject(new Error('No catalogue blob needed')));
  const product = createShardProduct({ slug: 'salt-marsh', revision: 1,
    shardfile: { ...source, identity: { ...source.identity, slug: 'salt-marsh' } },
    sections: new Map<string, unknown>([['combat/items', { items: source.items }]]), files: new Map(), read, check: false });
  const rows = { weapon: vi.fn<ShardContext['rows']['weapon']>(), ammo: vi.fn<ShardContext['rows']['ammo']>(),
    effect: vi.fn<ShardContext['rows']['effect']>(), shop: vi.fn<ShardContext['rows']['shop']>(), encounter: vi.fn<ShardContext['rows']['encounter']>(),
    skin: vi.fn<ShardContext['rows']['skin']>() };
  const context = legacyDouble<ShardContext>({ scope, product, rows: legacyDouble<ShardContext['rows']>(rows) });
  return { scope, product, context, rows, read };
}

test('catalogue metadata retains original equipment, effects, economy and skin registration order', () => {
  const f = fixture(), projected = driftwoodCatalogueEconomy(), original = declaredLootEconomy(parseRows({ strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [loot] }).loot);
  const finishes = vi.spyOn(HeldFinishes, 'current').mockReturnValue(legacyDouble<HeldFinishes>({ list: () => [] }));
  try {
    const row = catalogue(input); installClientCatalogue(f.context, row);
    expect(f.rows.weapon).toHaveBeenCalledWith([new ItemCatalogue(source.items).equipment('weapon.crossbow')]);
    expect(f.rows.ammo).toHaveBeenCalledWith([...new ItemCatalogue(source.items).ammunition('weapon.crossbow').values()].map(ammo => ammo.row));
    expect(f.rows.effect).toHaveBeenCalledWith(STARTER_EFFECTS);
    expect(f.rows.encounter).toHaveBeenCalledWith({ id: 'marsh.sentry', displayName: 'The Reed Sentry', showHeadBar: true });
    expect(f.rows.shop).not.toHaveBeenCalled();
    expect(projected).toEqual({ effects: original.effects, goods: original.goods });
    installClientCatalogue(f.context, { ...row, finishes: true, economy: projected });
    expect(f.rows.effect).toHaveBeenLastCalledWith(original.effects);
    expect(f.rows.shop).toHaveBeenCalledWith(original.goods);
    const last = (calls: number[]) => { const value = calls.at(-1); if (value === undefined) throw new Error('Missing registration'); return value; };
    expect(last(f.rows.effect.mock.invocationCallOrder)).toBeLessThan(last(f.rows.shop.mock.invocationCallOrder));
    expect(last(f.rows.shop.mock.invocationCallOrder)).toBeLessThan(last(f.rows.skin.mock.invocationCallOrder));
    expect(f.read).not.toHaveBeenCalled(); expect(f.product.has('economy/loot')).toBe(false);
    expect(() => catalogue({ ...input, install: () => undefined })).toThrow();
    const before = f.rows.weapon.mock.calls.length;
    expect(() => installClientCatalogue(f.context, { ...row, weapons: ['missing'] })).toThrow();
    expect(f.rows.weapon.mock.calls).toHaveLength(before);
  } finally { finishes.mockRestore(); f.scope.dispose(); }
});

test('catalogue reference failures and unknown ownership refuse before any registration', () => {
  const f = fixture(), economy = driftwoodCatalogueEconomy(), [effect] = economy.effects, [good] = economy.goods;
  if (effect === undefined || good === undefined) throw new Error('Missing original economy rows');
  const invalid: CatalogueEconomy[] = [
    { ...economy, effects: [...economy.effects, effect] }, { ...economy, goods: [...economy.goods, good] },
    { ...economy, effects: [{ ...effect, removes: ['effect.missing'] }] },
    { ...economy, goods: [{ ...good, needs: 'missing' }] }, { ...economy, goods: [{ ...good, needs: good.id }] },
  ];
  try {
    for (const rows of invalid) {
      expect(() => catalogue({ ...input, economy: rows })).toThrow();
      expect(() => installClientCatalogue(f.context, { ...catalogue(input), economy: rows })).toThrow();
    }
    const unknownOwned = catalogue({ ...input, economy: { effects: economy.effects, goods: [{ ...good, id: 'unknown-owned' }] } });
    expect(() => installClientCatalogue(f.context, unknownOwned)).toThrow('ownership');
    expect(() => catalogue({ ...input, economy: true })).toThrow();
    for (const register of Object.values(f.rows)) expect(register).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('catalogue economy reuses the defining grammar and emits a structural wire schema', () => {
  const rows = driftwoodCatalogueEconomy(), schema = namedJsonSchema(CatalogueEconomySchema);
  const bytes = new TextEncoder().encode(encodeCanonicalJson(schema));
  expect(validateDefinedSection(bytes, rows)).toEqual(rows);
  expect(v.parse(CatalogueEconomySchema, rows)).toEqual(rows);
  expect(() => v.parse(CatalogueEconomySchema, { ...rows, source: 'economy/loot' })).toThrow();
  expect(() => validateDefinedSection(bytes, { ...rows, source: 'economy/loot' })).toThrow();
});

test('a direct economy accessor refuses without invocation or registration', () => {
  const f = fixture(), economy = driftwoodCatalogueEconomy(), effects = economy.effects, getter = vi.fn(() => effects);
  Object.defineProperty(economy, 'effects', { enumerable: true, get: getter });
  try {
    expect(() => installClientCatalogue(f.context, { ...catalogue(input), economy })).toThrow('JSON-only');
    expect(getter).not.toHaveBeenCalled();
    for (const register of Object.values(f.rows)) expect(register).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('ancestor retirement refuses before reading the product or registering any row', () => {
  const parent = new Scope('catalogue-parent'), f = fixture(parent), productRead = vi.fn(() => f.product);
  Object.defineProperty(f.context, 'product', { get: productRead });
  parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
  try {
    expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
    expect(() => installClientCatalogue(f.context, catalogue(input))).toThrow('Invalid content catalogue');
    expect(productRead).not.toHaveBeenCalled();
    for (const register of Object.values(f.rows)) expect(register).not.toHaveBeenCalled();
  } finally { for (const step of retirement) void step; parent.dispose(); }
});
