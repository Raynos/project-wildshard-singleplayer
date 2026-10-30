// oxlint-disable-next-line import/no-nodejs-modules -- The native comparison uses the unchanged shipped physics bytes.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {loadHeadlessProduct} from '../src/sdk/headlessProduct';
import {outputDescriptor} from '../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../src/engine/physics/rapier';
import {snapshotSimHost} from '../src/engine/sim/snapshot';
import {decodeTerrainTile} from '../src/format/terrainTileBytes';
import {nativePopulationOf} from '../src/game/riding/nativePopulation';
import {builtProduct} from './fixtures/builtProduct';
import {createNativeProofResident} from './fixtures/headless-native';
import {prepareHeadlessRuntime} from './fixtures/nalati-headless';
import {readNalatiPatrolIntake} from './fixtures/nalati-patrol-intake';
import {canonicalSimDigest} from './fake/simState';

test('admitting conditional patrol recipes preserves the complete page-joined initial population and every RNG draw',async()=>{
  const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
  const descriptor=outputDescriptor(shard);if(descriptor===undefined)throw new Error('Missing admitted native inventory');
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const input=await readNalatiPatrolIntake(product),original=JSON.stringify(input);
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm')),preparation={shard,assets,rapier,product};
  const before=await createNativeProofResident(preparation,prepareHeadlessRuntime);
  let after:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
  try{
    after=await createNativeProofResident(preparation,context=>prepareHeadlessRuntime(context,decodeTerrainTile,input));
    const originalPopulation=nativePopulationOf(before.host),extended=nativePopulationOf(after.host);
    if(originalPopulation===undefined||extended===undefined)throw new Error('Missing original native population owners');
    expect(canonicalSimDigest(snapshotSimHost(after.host))).toBe(canonicalSimDigest(snapshotSimHost(before.host)));
    expect(after.host.rng.snapshot()).toEqual(before.host.rng.snapshot());
    expect(extended.rng.snapshot()).toEqual(originalPopulation.rng.snapshot());
    expect(extended.available()).toBe(originalPopulation.available());
    for(const row of input.recipes){
      expect(()=>originalPopulation.validateSpawn(row.kind,row.variant)).toThrow('Foreign');
      extended.validateSpawn(row.kind,row.variant);
    }
    // Recipe admission is deliberately inert: no ghost body, identity, guest
    // tick or random draw is paid until the real patrol decides to spawn.
    expect(canonicalSimDigest(snapshotSimHost(after.host))).toBe(canonicalSimDigest(snapshotSimHost(before.host)));
    expect(extended.rng.snapshot()).toEqual(originalPopulation.rng.snapshot());
    expect(JSON.stringify(input)).toBe(original);
    for(let tick=0;tick<60;tick++){
      before.step([]);after.step([]);
      expect(after.host.rng.snapshot()).toEqual(before.host.rng.snapshot());
    }
    expect(canonicalSimDigest(snapshotSimHost(after.host))).toBe(canonicalSimDigest(snapshotSimHost(before.host)));
  }finally{after?.dispose();before.dispose();}
},30_000);
