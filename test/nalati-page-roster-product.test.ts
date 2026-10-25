import { expect,test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the live population book without a generated JSON type edge.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { CombatTargetRowsSchema } from '../src/format/targets';
import combatTargets from '../src/shards/nalati-grasslands/data/combatTargets.json' with { type: 'json' };
import { outputScriptAdmissionRows } from '../src/sdk/outputProduct';
import { decisionModuleContracts } from '../src/format/scriptContract';
import { validateShardfileAssets } from '../src/format/assetAdmission';
import { contentHash, readProjectAssets } from '../src/sdk/project';
import { buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';
import { PopulationFieldSchema } from '../src/format/populationEnvironment';

const populationInput:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/data/populationField.generated.json','utf8'));
const populationField=v.parse(PopulationFieldSchema,populationInput);

test('the shared assembly document retains the complete page elite roster and its contact lookup', async () => {
  const product = await readProjectAssets('src/shards/nalati-grasslands', undefined, { folder: 'nalati-grasslands', imageRoots: [
    { prefix: '/assets/nalati/baked/', directory: 'public/assets/nalati/baked' },
  ] });
  const bootFile = product.output.namedFiles?.find(row => row.name === 'sim/headless-boot.json');
  const bootBytes = bootFile === undefined ? undefined : product.assets.get(bootFile.hash);
  if (bootBytes === undefined) throw new Error('Missing admitted combat target rows');
  const boot = v.parse(v.object({ combatTargets: CombatTargetRowsSchema }), JSON.parse(new TextDecoder().decode(bootBytes)));
  expect(boot.combatTargets).toEqual(combatTargets);
  const scripts=outputScriptAdmissionRows(product.output.platform);
  expect(new Set(scripts.filter(row=>row.side==='sim').map(row=>row.module)).size).toBe(8);
  expect(()=>validateShardfileAssets(product.shard,product.assets,contentHash,undefined,undefined,scripts)).not.toThrow();
  expect(product.output.namedFiles?.some(row=>row.name==='behaviour/nalati.titan.attack.wasm')).toBe(false);
  const fightFile=product.output.namedFiles?.find(row=>row.name==='combat/titan-fight.json');
  const fightBytes=fightFile===undefined?undefined:product.assets.get(fightFile.hash);
  if(fightBytes===undefined)throw new Error('Missing dual-port witness');
  const fight=v.parse(v.object({programs:v.object({attack:v.object({script:v.object({module:v.string()}),bytes:v.string()})})}),JSON.parse(new TextDecoder().decode(fightBytes)));
  const witness=fight.programs.attack;
  expect(witness.bytes).toBe('');
  const witnessFile=product.output.namedFiles?.find(row=>row.name==='behaviour/titan-witness.bin');
  const witnessBytes=witnessFile===undefined?undefined:product.assets.get(witnessFile.hash);
  if(witnessBytes===undefined)throw new Error('Missing admitted original witness sidecar');
  expect(`blobs/wasm/${contentHash(witnessBytes)}.wasm`).toBe(witness.script.module);
  expect(scripts.some(row=>row.module===witness.script.module)).toBe(false);
  const projection=product.output.namedFiles?.find(row=>row.name==='behaviour/nalati.titan.attack.v2.wasm');
  if(projection===undefined)throw new Error('Missing selected project module');
  const contracts=decisionModuleContracts(outputScriptAdmissionRows(product.output.platform),product.shard.files);
  expect(contracts.get(projection.hash)).toMatchObject({abi:2,lane:'project',pages:1});
  const file = product.output.namedFiles?.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : product.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing actual admitted assembly document');
  const assembly = v.parse(v.object({ constants: v.object({ pageElites: v.unknown(),nativeRide: v.record(v.string(),v.unknown()),nativeField: v.object({ world: v.unknown() }) }) }),JSON.parse(new TextDecoder().decode(bytes)));
  expect(assembly.constants.nativeRide).not.toHaveProperty('world');
  expect(assembly.constants.nativeField.world).toEqual(populationField.world);
  expect(assembly.constants.pageElites).toEqual(buildEliteEntryPageRows());
});
