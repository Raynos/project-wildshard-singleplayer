// oxlint-disable-next-line import/no-nodejs-modules -- The native reader receives the original fixed authoring buffers.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import * as v from 'valibot';
import {pinePhysicsBytes,pinePhysicsOwnersBytes,pinePhysicsOwners,pineWorldPhysics} from '../src/shards/pine-hollow/generators/physics';
import {PinePhysicsSchema,PinePhysicsOwnersSchema} from '../src/shards/pine-hollow/generators/sections';
import {worldPhysicsSection,emitPlatformSections} from '@wildshard/sharddev/platformSections';
import {createNativeBakeReader} from '@wildshard/game/population/nativeBake';
import terrain from '../src/shards/pine-hollow/data/terrainBindings.json' with {type:'json'};

const original:unknown=JSON.parse(new TextDecoder().decode(pinePhysicsBytes()));
v.assert(PinePhysicsSchema,original);
const policy={rig:'segments',provenance:'piece'} as const;
const nativeRows={label:'Pine',resolution:terrain.res,size:terrain.size,parked:true,...policy,shapes:[1,2,6,9]};
const ground={file:'data/physics-ground.bin',bytes:new Uint8Array(readFileSync('src/shards/pine-hollow/data/physics-ground.bin'))};
const blocks=[{file:'data/physics-colliders.bin',bytes:new Uint8Array(readFileSync('src/shards/pine-hollow/data/physics-colliders.bin'))}];
const raw=(array:Float32Array|Uint32Array)=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);

test('the common section and retained owners reconstruct every original transport field',()=>{
  const world=pineWorldPhysics(),owners:unknown=JSON.parse(new TextDecoder().decode(pinePhysicsOwnersBytes()));
  expect(world).toEqual(worldPhysicsSection(original,policy));
  expect(owners).toEqual(pinePhysicsOwners());
  const {rig:_,provenance:__,...common}=world;
  expect({...common,...pinePhysicsOwners()}).toEqual(original);
  expect(Object.keys(pinePhysicsOwners())).toEqual(['version','profile','notice','kingHit','trees','shelterTrees','pieces']);
  expect(owners).not.toHaveProperty('ground');expect(owners).not.toHaveProperty('actors');
  expect(world).not.toHaveProperty('kingHit');expect(world).not.toHaveProperty('pieces');
  const emitted=emitPlatformSections(new Map([['world/physics',world]]));
  const bytes=emitted.files.get('sections/world/physics.json');if(bytes===undefined)throw new Error('Missing common section bytes');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(world);
});

test('the same stock native reader retains every decoded ground, solid and actor byte',()=>{
  const before=createNativeBakeReader(original,nativeRows,ground,blocks).read();
  const emitted=emitPlatformSections(new Map([['world/physics',pineWorldPhysics()]]));
  const wire=emitted.files.get('sections/world/physics.json');if(wire===undefined)throw new Error('Missing emitted world physics');
  const after=createNativeBakeReader(JSON.parse(new TextDecoder().decode(wire)),nativeRows,ground,blocks).read();
  expect(after).toEqual(before);expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  expect(raw(after.ground.heights)).toEqual(raw(before.ground.heights));
  for(const [index,solid]of after.solids.entries()){
    const old=before.solids[index];if(old===undefined)throw new Error('Lost original solid');
    for(const key of ['points','indices'] as const){const first=solid[key],second=old[key];
      if(first!==undefined){if(second===undefined)throw new Error('Lost original native buffer');expect(raw(first)).toEqual(raw(second));}}
  }
});

test('the original owner bounds and native identity refusals remain authoritative',()=>{
  const owners=pinePhysicsOwners();
  expect(()=>v.parse(PinePhysicsOwnersSchema,{...owners,kingHit:{...owners.kingHit,radius:0}})).toThrow();
  expect(()=>v.parse(PinePhysicsOwnersSchema,{...owners,shelterTrees:[[0,0,1,2,1.1]]})).toThrow();
  const world=pineWorldPhysics(),first=world.actors[0];if(first===undefined)throw new Error('Missing real actor');
  expect(()=>worldPhysicsSection({...world,actors:[...world.actors,first]},policy)).toThrow('Divergent or duplicate native actor identity');
  expect(()=>createNativeBakeReader(world,nativeRows,{...ground,bytes:ground.bytes.subarray(0,4)},blocks).read()).toThrow('lattice');
});
