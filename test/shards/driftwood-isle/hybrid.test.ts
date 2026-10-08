import { expect, it } from 'vitest';
import { Flags } from '../../../src/engine/world/interact/flags';
import { QuestState } from '../../../src/engine/quest/core';
import { Progress } from '../../../src/game/Progress';
import { GridAssembly } from '../../../src/game/grid/assembly';
import { firstPartyInstance } from '../../../src/game/grid/instances';
import { progressSave } from '../../../src/game/saves';
import { DRIFTWOOD_QUEST, QUEST_DONE } from '../../../src/shards/driftwood-isle/quest/questLine';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_RUNTIME_COST } from '../../../src/shards/driftwood-isle/data/runtimeCost';
import { DRIFTWOOD_ISLE } from '../../../src/shards/driftwood-isle/manifest';

it('discovers the home through the same exact trusted entry as a fresh owned regional admission', async () => {
  expect(DRIFTWOOD_ISLE.gridShardfile).toBe('/shardfiles/driftwood-isle/shard.json');
  expect(DRIFTWOOD_ISLE.trustedRuntime).toEqual({ slug: source.identity.slug, entry: source.runtime?.entry });
  const load = DRIFTWOOD_ISLE.load;
  if (load === undefined) throw new Error('Missing ordinary lazy loader');
  const loaded = await load(), resolve = loaded.resolveTrustedRuntime;
  if (resolve === undefined) throw new Error('Missing admitted runtime resolver');
  expect(resolve('runtime/hybrid.ts')).toBe((await import('../../../src/shards/driftwood-isle/runtime/hybrid')).default);
  expect(resolve('runtime/hybrid.ts')).not.toBe(loaded.default);
  expect(() => resolve('runtime/index.ts')).toThrow('Unknown trusted runtime entry');
});

it('declares the trusted entry and uses one completed quest and achievement save in standalone and the placed grid cell', () => {
  expect(source.runtime).toMatchObject({ entry: 'runtime/hybrid.ts', cost: DRIFTWOOD_RUNTIME_COST, binds: ['quests', 'ledger', 'items', 'spawns'] });
  expect(source.runtime?.spawns?.bosses.map(row => row.id)).toEqual(['driftwood.captain']);
  const slug = source.identity.slug, assembly = new GridAssembly({ developer: false, devserver: false });
  const cell = assembly.cell(firstPartyInstance(slug));
  expect(cell.instance).toBe(slug); expect(cell.slug).toBe(slug);
  const standaloneFlags = new Flags(slug), standalone = new QuestState(DRIFTWOOD_QUEST, standaloneFlags);
  standaloneFlags.reset(); progressSave.reset(slug);
  const progress = new Progress(`chunk://local/${slug}`);
  try {
    for (const flag of ['talked:castaway', 'shard:lookout', 'shard:wreck', 'shard:cave', 'used:altar', 'dead:captain', 'seen:reward']) standaloneFlags.set(flag);
    expect(standalone.isComplete).toBe(true); expect(standaloneFlags.has(QUEST_DONE)).toBe(true);
    // The legacy Feats installer records this idempotent event after seeing QUEST_DONE.
    progress.recordEvent('quest', 1);
    const gridFlags = new Flags(cell.instance), grid = new QuestState(DRIFTWOOD_QUEST, gridFlags);
    try {
      expect(grid.isComplete).toBe(true); expect(grid.index).toBe(DRIFTWOOD_QUEST.steps.length);
      expect(new Progress(cell.instance).earned('quest')).toBe(true);
      expect(new Progress(cell.instance).count('quest')).toBe(1);
      gridFlags.set('used:zipline');
      expect(new Flags(slug).has('used:zipline')).toBe(true);
      expect(new Progress(`chunk://local/${slug}`).earned('quest')).toBe(true);
    } finally { grid.dispose(); }
  } finally { standalone.dispose(); standaloneFlags.reset(); progressSave.reset(slug); }
});
