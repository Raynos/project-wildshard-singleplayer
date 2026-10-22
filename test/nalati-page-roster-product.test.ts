import { expect,test } from 'vitest';
import * as v from 'valibot';
import { outputScriptAdmissionRows } from '../src/sdk/outputProduct';
import { decisionModuleContracts } from '../src/format/scriptContract';
import { readProjectAssets } from '../src/sdk/project';
import { buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';
import ridingTerrain from '../src/shards/nalati-grasslands/data/ridingTerrain.generated.json' with { type: 'json' };

test('the shared assembly document retains the complete page elite roster and its contact lookup', async () => {
  const product = await readProjectAssets('src/shards/nalati-grasslands');
  const projection=product.output.namedFiles?.find(row=>row.name==='behaviour/nalati.titan.attack.v2.wasm');
  if(projection===undefined)throw new Error('Missing selected project module');
  const contracts=decisionModuleContracts(outputScriptAdmissionRows(product.output.platform),product.shard.files);
  expect(contracts.get(projection.hash)).toMatchObject({abi:2,lane:'project',pages:1});
  const file = product.output.namedFiles?.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : product.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing actual admitted assembly document');
  const assembly = v.parse(v.object({ constants: v.object({ pageElites: v.unknown(),nativeRide: v.record(v.string(),v.unknown()),nativeField: v.object({ world: v.unknown() }) }) }),JSON.parse(new TextDecoder().decode(bytes)));
  expect(assembly.constants.nativeRide).not.toHaveProperty('world');
  expect(assembly.constants.nativeField.world).toEqual(ridingTerrain);
  expect(assembly.constants.pageElites).toEqual(buildEliteEntryPageRows());
});
