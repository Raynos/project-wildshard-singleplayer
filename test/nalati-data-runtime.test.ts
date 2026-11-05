// oxlint-disable-next-line import/no-nodejs-modules -- Audit the actual removed authored entry files.
import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { runtimeAccountedBytes } from '@wildshard/format/runtimeCost';
import { runtimeBinds } from '../src/game/server/plugin/headless';
import { regionalRuntimeAccountedBytes } from '../src/game/client/grid/regionalRuntime';
import { useOwnedGridHome } from '../src/game/client/grid/pageShell';
import { MANIFEST } from '../src/shards/nalati-grasslands/discovery.generated';
import source from './fixtures/nalati-product-source';
import spawns from '../src/shards/nalati-grasslands/data/spawns.json' with { type: 'json' };
import cost from '../src/shards/nalati-grasslands/data/runtimeCost.json' with { type: 'json' };

test('Nalati compiled entry preserves original native binds, section authority, runtime cost and home retention', () => {
  const runtime = source.runtime;
  if (runtime === null) throw new Error('Missing compiled runtime declaration');
  if(runtime.spawns===undefined)throw new Error('Missing original runtime spawns');
  expect(runtime.spawns).toEqual(spawns);
  expect(runtime.kind).toBe('client-plan'); expect(runtime.cost).toEqual(cost);
  expect([...runtimeBinds(source)]).toEqual(['quests','ledger','state','items','spawns','modes','clientChannels','terrain','props']);
  expect(regionalRuntimeAccountedBytes({ source }, MANIFEST)).toBe(runtimeAccountedBytes(cost));
  expect(MANIFEST.clientPlanRuntime).toBe(true); expect(Object.hasOwn(MANIFEST, 'trustedRuntime')).toBe(false);
  expect(useOwnedGridHome('grid', MANIFEST, source)).toBe(true);
  expect(useOwnedGridHome('shard', MANIFEST, source)).toBe(false);
  expect(existsSync('src/shards/nalati-grasslands-legacy')).toBe(false);
  for (const path of ['plugin.ts', 'runtime/index.ts', 'runtime/state.ts']) {
    expect(existsSync(`src/shards/nalati-grasslands/${path}`), path).toBe(false);
  }
});
