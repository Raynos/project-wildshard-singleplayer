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

const populationInput:unknown=JSON.parse(readFileSync('test/fixtures/nalati-population-field-original.json','utf8'));
const populationField=v.parse(PopulationFieldSchema,populationInput);

// Build the complete native source product once before the original timed
// roster/admission assertions; do not charge compiler/cache setup to that case.
const nalatiEnvelope = await readProjectAssets('src/shards/nalati-grasslands', undefined, { folder: 'nalati-grasslands', imageRoots: [
    { prefix: '/src/shards/nalati-grasslands/', directory: 'src/shards/nalati-grasslands' },
    { prefix: '/assets/', directory: 'public/assets' },
  ] });

test('proof-only native physics stays byte-exact and out of the entered warm', () => {
  const expected = [
    ['data/physics-ground.bin', '13d0dbaf5c19066bad33a1ca49587029430ce44538665094fae7bdd5568660f5', 262144],
    ['data/physics-colliders-0.bin', '238c9e25120ab8e89ddf3f8c20434e9a808b7bc19cb2a928011ca3f90ade34f1', 999840],
    ['data/physics-colliders-1.bin', 'a98661800d44e6dfb62b81ecdb310eeebe09837f373bf260dfcae5da07c72d95', 147120],
  ] as const;
  const late = new Set(nalatiEnvelope.shard.late?.map(row => row.hash));
  for (const [name, hash, bytes] of expected) {
    const file = nalatiEnvelope.output.namedFiles?.find(row => row.name === name);
    expect(file, name).toMatchObject({ hash, compressed: bytes, decoded: bytes, critical: false, dependencies: [] });
    const payload = nalatiEnvelope.assets.get(hash);
    if (payload === undefined) throw new Error(`Missing admitted proof bytes: ${name}`);
    expect(contentHash(payload), name).toBe(hash);
    expect(late.has(hash), name).toBe(true);
  }
  const references = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string') references.add(value);
    else if (Array.isArray(value)) for (const child of value) collect(child);
    else if (value !== null && typeof value === 'object') for (const child of Object.values(value)) collect(child);
  };
  for (const [path, bytes] of nalatiEnvelope.output.platform?.files ?? []) {
    if (path.startsWith('sections/')) collect(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
  }
  // A future client JSON book must not silently turn a proof-only buffer into
  // an entered input while its authoring hint still excludes the initial warm.
  for (const file of nalatiEnvelope.output.namedFiles ?? []) {
    if (file.kind !== 'json') continue;
    const bytes = nalatiEnvelope.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing admitted named JSON: ${file.name ?? file.hash}`);
    collect(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown);
  }
  for (const [name, hash] of expected) {
    expect(references.has(name), name).toBe(false);
    expect(references.has(hash), name).toBe(false);
  }
});

test('the shared assembly document retains the complete page elite roster and its contact lookup', () => {
  const product = nalatiEnvelope;
  const bootFile = product.output.namedFiles?.find(row => row.name === 'sim/headless-boot.json');
  const bootBytes = bootFile === undefined ? undefined : product.assets.get(bootFile.hash);
  if (bootBytes === undefined) throw new Error('Missing admitted combat target rows');
  const boot = v.parse(v.object({ combatTargets: CombatTargetRowsSchema }), JSON.parse(new TextDecoder().decode(bootBytes)));
  expect(boot.combatTargets).toEqual(combatTargets);
  const scripts=outputScriptAdmissionRows(product.output.platform);
  const sim = scripts.filter(row=>row.side==='sim');
  // The original eight stay; GR6 publishes the formerly inline course as the ninth.
  expect(new Set(sim.filter(row=>row.id!=='practice.course').map(row=>row.module)).size).toBe(8);
  expect(sim.filter(row=>row.id==='practice.course').map(row=>row.module)).toEqual(['blobs/wasm/6ffc72748c1709f4239ac983fdda5841a524a026512287fe16f0fa498b276102.wasm']);
  expect(new Set(sim.map(row=>row.module)).size).toBe(9);
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
