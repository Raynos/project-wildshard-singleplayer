// oxlint-disable-next-line import/no-nodejs-modules -- Verify the exact committed build-only alias data.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Audit only this shard's authored runtime directory.
import {existsSync,readdirSync} from 'node:fs';
import {expect,test} from 'vitest';
import {outputSectionPayloads} from '../src/format/outputIndex';
import {runtimeBinds,withoutRuntimeRows} from '../src/game/plugin/headless';
import {regionalRuntimeAccountedBytes} from '../src/game/grid/regionalRuntime';
import {useOwnedGridHome} from '../src/game/grid/pageShell';
import {MANIFEST} from '../src/shards/pine-hollow/discovery.generated';
import source from '../src/shards/pine-hollow/generators/product';
import cost from '../src/shards/pine-hollow/data/runtimeCost.json' with {type:'json'};
import aliases from '../src/shards/pine-hollow/data/astc6.generated.json' with {type:'json'};
import {runtimeAccountedBytes} from '../src/format/runtimeCost';

test('the Pine compiled entry keeps original source authority, spawns, host payloads and charges',()=>{
  const runtime=source.runtime;if(runtime===null||'entry' in runtime)throw new Error('Pine still names a TS runtime');
  const previous={...source,runtime:{entry:'runtime/hybrid.ts',cost:runtime.cost,binds:runtime.binds,spawns:runtime.spawns}};
  expect(runtime.kind).toBe('client-plan');expect(runtime.cost).toEqual(cost);
  expect([...runtimeBinds(source)]).toEqual(['terrain','props','quests','ledger','items','spawns','state','modes','movers','clientChannels']);
  expect(runtime.spawns).toEqual(previous.runtime.spawns);
  expect(outputSectionPayloads(source)).toEqual(outputSectionPayloads(previous));
  const {runtime:_compiled,...actual}=withoutRuntimeRows(source),{runtime:_legacy,...old}=withoutRuntimeRows(previous);
  expect(actual).toEqual(old);
  expect(regionalRuntimeAccountedBytes({source},MANIFEST)).toBe(runtimeAccountedBytes(cost));
  expect(regionalRuntimeAccountedBytes({source},MANIFEST,'img')).toBe(runtimeAccountedBytes(cost.imagesFirst));
  expect(MANIFEST.trustedRuntime).toBeUndefined();expect(MANIFEST.clientPlanRuntime).toBe(true);expect(useOwnedGridHome('grid',false,MANIFEST)).toBe(true);expect(useOwnedGridHome('grid',false,MANIFEST,source)).toBe(true);expect(useOwnedGridHome('shard',false,MANIFEST,source)).toBe(false);
});

test('the removed source directory contains no authored executable or baked alias TS',()=>{
  const dir='src/shards/pine-hollow/runtime';
  const files=existsSync(dir)?readdirSync(dir,{recursive:true,withFileTypes:true}).filter(row=>row.isFile()&&row.name.endsWith('.ts')&&!row.name.endsWith('.d.ts')):[];
  expect(files).toEqual([]);
  expect(Object.keys(aliases)).toHaveLength(83);
  expect(createHash('sha256').update(JSON.stringify(aliases)).digest('hex')).toBe('362974e7dd0cfc8ba578e1f2c6dc358d28e3a15a165b0a78ab0a86199674f3ba');
});
