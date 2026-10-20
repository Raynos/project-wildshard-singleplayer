import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { parseClientPlan } from '../src/format/clientPlan';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installClientCatalogue } from '../src/game/shardfile/clientCatalogue';
import type { ShardContext } from '../src/game/plugin/context';
import { readItemEquipment, readItemAmmunition } from '../src/game/plugin/nativeItems';
import source from '../src/shards/pine-hollow/shard.config';
import { STARTER_EFFECTS } from '../src/game/plugin/ui';

test('salt-marsh kit registers authored equipment, ammunition and encounters without a runtime hook', () => {
  const scope = new Scope('marsh.catalogue'), product = createShardProduct({ slug: 'salt-marsh', revision: 1,
    shardfile: { ...source, identity: { ...source.identity, slug: 'salt-marsh' } },
    sections: new Map([['combat/items', { items: source.items }]]), files: new Map(),
    read: () => Promise.reject(new Error('No catalogue blob needed')), check: false });
  const rows = { weapon: vi.fn<ShardContext['rows']['weapon']>(), ammo: vi.fn<ShardContext['rows']['ammo']>(),
    effect: vi.fn<ShardContext['rows']['effect']>(), encounter: vi.fn<ShardContext['rows']['encounter']>() };
  const context = { scope, product } as ShardContext;
  Object.defineProperty(context, 'rows', { value: rows });
  const input = { kind: 'content.catalogue', quests: false, finishes: false,
    weapons: ['weapon.crossbow'], ammunition: ['weapon.crossbow'], effects: ['starter'], compendiums: [],
    encounters: [{ id: 'marsh.sentry', displayName: 'The Reed Sentry', showHeadBar: true }] };
  try {
    const plan = parseClientPlan({ version: 1, features: [input] }), row = plan.features[0];
    if (row === undefined) throw new Error('Missing admitted catalogue');
    installClientCatalogue(context, row);
    expect(rows.weapon).toHaveBeenCalledWith([readItemEquipment(source.items, 'weapon.crossbow')]);
    expect(rows.ammo).toHaveBeenCalledWith([...readItemAmmunition(source.items, 'weapon.crossbow').values()].map(ammo => ammo.row));
    expect(rows.effect).toHaveBeenCalledWith(STARTER_EFFECTS);
    expect(rows.encounter).toHaveBeenCalledWith({ id: 'marsh.sentry', displayName: 'The Reed Sentry', showHeadBar: true });
    expect(() => parseClientPlan({ version: 1, features: [{ ...input, install: () => undefined }] })).toThrow();
    const before = rows.weapon.mock.calls.length;
    expect(() => installClientCatalogue(context, { ...row, weapons: ['missing'] })).toThrow();
    expect(rows.weapon.mock.calls).toHaveLength(before);
  } finally { scope.dispose(); }
});
