// oxlint-disable-next-line import/no-nodejs-modules -- Audit the actual removed authored entry files.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { outputSectionPayloads } from '../src/format/outputIndex';
import { runtimeAccountedBytes } from '../src/format/runtimeCost';
import { runtimeBinds, withoutRuntimeRows } from '../src/game/plugin/headless';
import { regionalRuntimeAccountedBytes } from '../src/game/grid/regionalRuntime';
import { useOwnedGridHome } from '../src/game/grid/pageShell';
import { MANIFEST } from '../src/shards/nine-dragon-stack/discovery.generated';
import source from '../src/shards/nine-dragon-stack/shard.config';
import cost from '../src/shards/nine-dragon-stack/data/runtimeCost.json' with { type: 'json' };

test('Nine compiled entry preserves original native binds, section authority, runtime cost and home retention', () => {
  const runtime = source.runtime;
  if (runtime === null || 'entry' in runtime) throw new Error('Nine still names a TS entry');
  const previous = { ...source, runtime: { entry: 'runtime/index.ts', cost: runtime.cost, binds: runtime.binds } };
  expect(runtime.kind).toBe('client-plan'); expect(runtime.cost).toEqual(cost);
  expect([...runtimeBinds(source)]).toEqual(['props', 'items', 'ledger', 'modes']);
  expect(outputSectionPayloads(source)).toEqual(outputSectionPayloads(previous));
  const { runtime: _compiled, ...actual } = withoutRuntimeRows(source), { runtime: _legacy, ...old } = withoutRuntimeRows(previous);
  expect(actual).toEqual(old);
  expect(regionalRuntimeAccountedBytes({ source }, MANIFEST)).toBe(runtimeAccountedBytes(cost));
  expect(MANIFEST.clientPlanRuntime).toBe(true); expect(MANIFEST.trustedRuntime).toBeUndefined();
  expect(useOwnedGridHome('grid', false, MANIFEST, source)).toBe(true);
  expect(useOwnedGridHome('shard', false, MANIFEST, source)).toBe(false);
  for (const path of ['plugin.ts', 'runtime/index.ts', 'runtime/state.ts', 'world/build.ts']) {
    expect(existsSync(`src/shards/nine-dragon-stack/${path}`), path).toBe(false);
  }
});
