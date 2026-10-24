// oxlint-disable-next-line import/no-nodejs-modules -- Audit the actual removed authored entry files.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { outputSectionPayloads } from '../src/format/outputIndex';
import { runtimeAccountedBytes } from '../src/format/runtimeCost';
import { runtimeBinds, withoutRuntimeRows } from '../src/game/plugin/headless';
import { regionalRuntimeAccountedBytes } from '../src/game/grid/regionalRuntime';
import { useOwnedGridHome } from '../src/game/grid/pageShell';
import { MANIFEST } from '../src/shards/nalati-grasslands/discovery.generated';
import source from '../src/shards/nalati-grasslands/shard.config';
import spawns from '../src/shards/nalati-grasslands/data/spawns.json' with { type: 'json' };
import cost from '../src/shards/nalati-grasslands/data/runtimeCost.json' with { type: 'json' };

test('Nalati compiled entry preserves original native binds, section authority, runtime cost and home retention', () => {
  const runtime = source.runtime;
  if (runtime === null || 'entry' in runtime) throw new Error('Nalati still names a TS entry');
  if(runtime.spawns===undefined)throw new Error('Missing original runtime spawns');
  const previous = { ...source, runtime: { entry: 'runtime/index.ts', cost: runtime.cost, binds: runtime.binds, spawns:runtime.spawns } };
  expect(runtime.spawns).toEqual(spawns);
  expect(runtime.kind).toBe('client-plan'); expect(runtime.cost).toEqual(cost);
  expect([...runtimeBinds(source)]).toEqual(['quests','ledger','state','items','spawns','modes','clientChannels','terrain','props']);
  expect(outputSectionPayloads(source)).toEqual(outputSectionPayloads(previous));
  const { runtime: _compiled, ...actual } = withoutRuntimeRows(source), { runtime: _legacy, ...old } = withoutRuntimeRows(previous);
  expect(actual).toEqual(old);
  expect(regionalRuntimeAccountedBytes({ source }, MANIFEST)).toBe(runtimeAccountedBytes(cost));
  expect(MANIFEST.clientPlanRuntime).toBe(true); expect(Object.hasOwn(MANIFEST, 'trustedRuntime')).toBe(false);
  expect(useOwnedGridHome('grid', MANIFEST, source)).toBe(true);
  expect(useOwnedGridHome('shard', MANIFEST, source)).toBe(false);
  expect(existsSync('src/shards/nalati-grasslands-legacy/adventure.ts')).toBe(true);
  for (const path of ['plugin.ts', 'runtime/index.ts', 'runtime/state.ts']) {
    expect(existsSync(`src/shards/nalati-grasslands/${path}`), path).toBe(false);
  }
});
