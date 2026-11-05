// oxlint-disable-next-line import/no-nodejs-modules -- Audit the actual removed authored entry files.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { runtimeAccountedBytes } from '@wildshard/format/runtimeCost';
import { runtimeBinds } from '../src/game/server/plugin/headless';
import { regionalRuntimeAccountedBytes } from '../src/game/client/grid/regionalRuntime';
import { useOwnedGridHome } from '../src/game/client/grid/pageShell';
import { MANIFEST } from '../src/shards/nine-dragon-stack/discovery.generated';
import source from './fixtures/nine-product-inputs';
import cost from '../src/shards/nine-dragon-stack/data/runtimeCost.json' with { type: 'json' };

test('Nine compiled entry preserves original native binds, section authority, runtime cost and home retention', () => {
  const runtime = source.runtime;
  if (runtime === null) throw new Error('Missing compiled runtime declaration');
  expect(runtime.kind).toBe('client-plan'); expect(runtime.cost).toEqual(cost);
  expect([...runtimeBinds(source)]).toEqual(['props', 'items', 'ledger', 'modes']);
  expect(regionalRuntimeAccountedBytes({ source }, MANIFEST)).toBe(runtimeAccountedBytes(cost));
  expect(MANIFEST.clientPlanRuntime).toBe(true); expect(Object.hasOwn(MANIFEST, 'trustedRuntime')).toBe(false);
  expect(useOwnedGridHome('grid', MANIFEST, source)).toBe(true);
  expect(useOwnedGridHome('shard', MANIFEST, source)).toBe(false);
  for (const path of ['plugin.ts', 'runtime/index.ts', 'runtime/state.ts', 'world/build.ts']) {
    expect(existsSync(`src/shards/nine-dragon-stack/${path}`), path).toBe(false);
  }
});
