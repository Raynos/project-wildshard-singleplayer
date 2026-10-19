// oxlint-disable-next-line import/no-nodejs-modules -- Startup reads the exact admitted shard product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The native capability map uses the checked repository entry.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Worker imports use the generated capability map's file URL.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { HeadlessSimulation } from '../src/sdk/headless';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { productHeadlessSections } from '../src/sdk/headlessSections';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { generateHeadlessModuleMap } from '../scripts/check-headless-assemblies.mjs';

test('Nalati boots its admitted native assembly to the first frame',async()=>{
  const product=await loadHeadlessProduct('out/nalati-grasslands'),descriptor=outputDescriptor(product.shardfile);
  if(descriptor===undefined)throw new Error('Missing startup inventory');
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`out/nalati-grasslands/${file.path}`))]));
  const entry=pathToFileURL(generateHeadlessModuleMap(resolve('.'),'nalati-grasslands')).href;
  const simulation=await HeadlessSimulation.create(product.shardfile,assets,undefined,{deadline:'advisory',sections:productHeadlessSections(product),trustedRuntime:{module:entry}});
  try{
    const first=decodeSimSnapshot((await simulation.step()).snapshot);
    expect(first.state.tick).toBeGreaterThan(0);expect(first.player.position.every(Number.isFinite)).toBe(true);expect(simulation.quarantined).toBe(false);
  }finally{await simulation.dispose();}
},120_000);
