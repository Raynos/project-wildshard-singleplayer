import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/game/shardfile/items';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
import { ITEMS } from '../src/shards/_template/data/items';

function fixture() {
  const source = emptyShardfile({ slug: 'native-tool', name: 'Native tool', author: 'Fixture', revision: 1, seed: 1 });
  const rows = parseItems(ITEMS).rows;
  const weapon = rows.find(row => row.kind === 'weapon' && row.hook === null);
  const lamp = rows.find(row => row.kind === 'tool');
  if (weapon?.kind !== 'weapon' || lamp?.kind !== 'tool') throw new Error('Missing item fixtures');
  const tool = { ...lamp, id: 'tool.grapple', family: 'native-tool.grapple', hook: null, action: null, fuelSeconds: 1, intensity: 0 };
  const items = { version: 1, rows: [weapon, tool], contexts: [], loadout: { primary: weapon.id, secondary: null, tools: [tool.id] } };
  const runtime = { entry: 'runtime/index.ts', binds: ['items'] };
  return { source, items, tool, weapon, runtime, lamp };
}

it('admits a runtime-owned native tool with no generic action or script hook', () => {
  const { source, items, runtime, tool } = fixture();
  const admitted = parseShardfile({ ...source, items, runtime });
  expect(admitted.items.rows[1]).toEqual(tool);
  expect(admitted.items.loadout.tools).toEqual(['tool.grapple']);
  expect(shardfileRules(admitted)).toEqual([]);
  expect(shardfileRules({ ...admitted, runtime: null })).toContain('native tools require runtime.binds items');
  for (const owner of [null, { entry: runtime.entry }, { entry: runtime.entry, binds: [] }, { entry: runtime.entry, binds: ['quests'] }]) {
    expect(() => parseShardfile({ ...source, items, runtime: owner })).toThrow('shardfile semantic rules');
  }
});

it('keeps native tool compatibility fields bounded and refuses hooks or implicit actions', () => {
  const { source, items, runtime, tool, weapon, lamp } = fixture();
  const admit = (row: unknown) => parseShardfile({ ...source, items: { ...items, rows: [weapon, row] }, runtime });
  for (const row of [{ ...tool, fuelSeconds: 0.001, intensity: 0 }, { ...tool, fuelSeconds: 86400, intensity: 10 }]) {
    expect(admit(row).items.rows[1]).toEqual(row);
  }
  for (const row of [{ ...tool, hook: lamp.hook }, { ...tool, hook: undefined }, { ...tool, action: undefined },
    { ...tool, action: '' }, { ...tool, action: 'toggle' }, { ...tool, action: () => undefined },
    { ...tool, fuelSeconds: 0 }, { ...tool, fuelSeconds: 86401 }, { ...tool, fuelSeconds: Infinity },
    { ...tool, intensity: -0.01 }, { ...tool, intensity: 10.01 }, { ...tool, intensity: Number.NaN }]) {
    expect(() => admit(row)).toThrow();
  }
});

it('preserves ordinary dotted lamp actions without requiring runtime ownership', () => {
  const { source, items, tool, weapon } = fixture();
  const lamp = { ...tool, action: 'fixture.lantern.toggle', fuelSeconds: 120, intensity: 2 };
  const admitted = parseShardfile({ ...source, items: { ...items, rows: [weapon, lamp] } });
  expect(admitted.runtime).toBeNull();
  expect(admitted.items.rows[1]).toEqual(lamp);
});
