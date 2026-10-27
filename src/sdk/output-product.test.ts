import { afterEach, expect, it } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- The output validator fixture owns its generated directory.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files inside the owned output directory.
import { resolve } from 'node:path';
import { emptyShardfile } from '@wildshard/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { runtimePackageAllowed, validateRuntimeImports } from './runtimeImports';
import { defineSection, emitDefinedSections } from '@wildshard/sdk/sections';
import { writeOutputProduct, validateOutputProduct } from './outputProduct';
import { encodeTerrainTile } from '@wildshard/format/terrainTileBytes';

const directories: string[] = [];
function output(): string { mkdirSync('tmp',{recursive:true});const path=mkdtempSync(resolve('tmp','output-product-'));directories.push(path);return path; }
const source = () => emptyShardfile({slug:'output-test',name:'Output',author:'Test',revision:1,seed:3});
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
it('writes deterministic sections and revalidates a custom schema from disk',()=>{
 const shard=source(), first=output(),second=output();
 const custom=emitDefinedSections([defineSection('custom/wind',v.strictObject({speed:v.number()}),{speed:7})]);
 const platform=emitPlatformSections(new Map([['ui/strings',{hello:'Hello'}]]));
 writeOutputProduct(shard,new Map(),first,{custom,platform});writeOutputProduct(shard,new Map(),second,{custom,platform});
 expect(readFileSync(resolve(first,'shard.json'))).toEqual(readFileSync(resolve(second,'shard.json')));
 expect(validateOutputProduct(first).shard).toEqual(shard);
 const evidence:unknown=JSON.parse(readFileSync(resolve(first,'validation.json'),'utf8'));
 expect(evidence).toMatchObject({indexHash:hashImmutableBytes(readFileSync(resolve(first,'shard.json'))),gridReady:{version:1,criteria:{
   bakedTiles:{verdict:'fail'},edgeProfile:{verdict:'pass'},fourEntryways:{verdict:'pass'},hudAccent:{verdict:'pass'},
 }}});
 const path=resolve(first,'schemas/custom/wind.schema.json');writeFileSync(path,'{}\n');
 expect(()=>validateOutputProduct(first)).toThrow(/hash|size/u);
});
it('splits terrain from opaque binary while retaining byte and field identity',()=>{
 const shard=source(),directory=output(),tile=encodeTerrainTile({resolution:2,x:0,z:0,size:1,heights:new Float32Array([1,2,3,4])}),bin=new Uint8Array([1,2,3]);
 const assets=new Map([tile,bin].map(bytes=>[hashImmutableBytes(bytes),bytes]));
 shard.files=[...assets].map(([hash,bytes])=>({hash,kind:'binary',compressed:bytes.length,decoded:bytes.length+1024,gpu:1024,triangles:4,draws:1,dependencies:[],critical:false}));shard.files.sort((a,b)=>a.hash.localeCompare(b.hash));shard.library=[...assets.keys()];shard.budgets.library={resident:100000,compressed:100000};
 const index=writeOutputProduct(shard,assets,directory);
 expect(index.files.map(file=>file.kind).sort()).toEqual(['bin','tile']);
 const restored=validateOutputProduct(directory);expect(restored.shard).toEqual(shard);expect(restored.assets).toEqual(assets);
 writeFileSync(resolve(directory,'unlisted.js'),'evil');expect(()=>validateOutputProduct(directory)).toThrow(/Unlisted/u);
 rmSync(resolve(directory,'unlisted.js'));
 const file=index.files[0];if(file===undefined)throw new Error('Missing fixture blob');
 const path=resolve(directory,file.path);rmSync(path);symlinkSync(resolve(directory,'shard.json'),path);
 expect(()=>validateOutputProduct(directory)).toThrow(/symlink/u);
});
it('packs the sections and the small files apart, each member once at its exact bytes (iPhone downloads I5)',()=>{
 const shard=source(),directory=output(),bin=new Uint8Array([1,2,3]),hash=hashImmutableBytes(bin);
 shard.files=[{hash,kind:'binary',compressed:3,decoded:3,gpu:0,triangles:0,draws:0,dependencies:[],critical:false}];shard.library=[hash];shard.budgets.library={resident:3,compressed:3};
 const index=writeOutputProduct(shard,new Map([[hash,bin]]),directory),[sectionPack,pack]=index.packs??[];
 if(sectionPack===undefined||pack===undefined||index.packs?.length!==2)throw new Error('Expected a section pack and a file pack');
 expect(new Set(sectionPack.entries.map(entry=>entry.hash))).toEqual(new Set(index.sections.map(entry=>entry.hash)));
 expect(pack.entries.map(entry=>entry.hash)).toEqual([hash]);
 const bytes=readFileSync(resolve(directory,sectionPack.path));
 for(const entry of sectionPack.entries)expect(hashImmutableBytes(bytes.subarray(entry.offset,entry.offset+entry.bytes))).toBe(entry.hash);
 expect(validateOutputProduct(directory).shard).toEqual(shard);
 const tampered=Uint8Array.from(bytes);tampered[0]=(tampered[0]??0)^1;writeFileSync(resolve(directory,sectionPack.path),tampered);
 expect(()=>validateOutputProduct(directory)).toThrow(/hash|size/u);
});
it('refuses canonical but schema-invalid section bytes with updated hash and size',()=>{
 const directory=output(),index=writeOutputProduct(source(),new Map(),directory);
 const entry=index.sections.find(row=>row.name==='world/spawn');if(entry===undefined)throw new Error('Missing spawn');
 const bytes=new TextEncoder().encode(encodeCanonicalJson({spawn:{x:'wrong',y:2,z:0,yaw:0}}));
 writeFileSync(resolve(directory,entry.path),bytes);entry.hash=hashImmutableBytes(bytes);entry.bytes=bytes.length;
 writeFileSync(resolve(directory,'shard.json'),encodeCanonicalJson(index));expect(()=>validateOutputProduct(directory)).toThrow();
});

it('packs medium bodies within 4 MiB without pulling late bytes into required reads',()=>{
 const shard=source(),directory=output();
 const bodies=Array.from({length:9},(_,i)=>new Uint8Array(i===8?1_048_576:716_800).fill(i+1));
 const assets=new Map(bodies.map(body=>[hashImmutableBytes(body),body])),hashes=[...assets.keys()];
 const late=hashes.slice(6,8),unpacked=hashes[8];
 shard.files=[...assets].map(([hash,body])=>({hash,kind:'binary' as const,compressed:body.length,decoded:body.length,gpu:0,triangles:0,draws:0,dependencies:[],critical:false})).sort((a,b)=>a.hash.localeCompare(b.hash));
 shard.library=hashes;shard.late=late.map(hash=>({hash}));shard.budgets.library={resident:8_000_000,compressed:8_000_000};
 const index=writeOutputProduct(shard,assets,directory),seen=new Set<string>();
 const bodyPacks=(index.packs??[]).filter(pack=>pack.entries.some(entry=>assets.has(entry.hash)));
 expect(bodyPacks).toHaveLength(3);
 for(const pack of bodyPacks){
  expect(pack.bytes).toBeLessThanOrEqual(4_194_304);
  const wire=readFileSync(resolve(directory,pack.path));
  expect(hashImmutableBytes(wire)).toBe(pack.hash);
  const phases=new Set(pack.entries.map(entry=>late.includes(entry.hash)));
  expect(phases.size).toBe(1);
  for(const entry of pack.entries){
   expect(seen.has(entry.hash)).toBe(false);seen.add(entry.hash);
   const original=assets.get(entry.hash);if(original===undefined)throw new Error('Missing original medium body');
   expect(wire.subarray(entry.offset,entry.offset+entry.bytes).equals(original)).toBe(true);
  }
 }
 expect([...seen].sort()).toEqual(hashes.filter(hash=>hash!==unpacked).sort());
 const restored=validateOutputProduct(directory);
 expect(restored.shard).toEqual(shard);expect([...restored.assets.keys()].sort()).toEqual([...assets.keys()].sort());
 for(const [hash,original]of assets){const body=restored.assets.get(hash);if(body===undefined)throw new Error('Missing restored body');expect(hashImmutableBytes(body)).toBe(hash);expect(body.length).toBe(original.length);}
});

it('keeps explicit phone, desktop and shared pack bodies separate in each admission phase',()=>{
 const shard=source(),directory=output(),bodies=Array.from({length:6},(_,i)=>new Uint8Array(131_072).fill(i+1));
 const assets=new Map(bodies.map(body=>[hashImmutableBytes(body),body])),hashes=[...assets.keys()];
 shard.files=[...assets].map(([hash,body])=>({hash,kind:'binary' as const,compressed:body.length,decoded:body.length,gpu:0,triangles:0,draws:0,dependencies:[],critical:false}));
 shard.library=hashes;shard.late=hashes.slice(3).map(hash=>({hash}));shard.budgets.library={resident:786_432,compressed:786_432};
 const namedFiles=shard.files.map((file,i)=>({...file,kind:'bin' as const,path:`blobs/bin/${file.hash}.bin`,name:`medium-${i}.bin`,
  ...(i%3===0?{}:{tier:i%3===1?'phone' as const:'desktop' as const})}));
 const index=writeOutputProduct(shard,assets,directory,{namedFiles});
 const packs=(index.packs??[]).filter(pack=>pack.entries.some(entry=>assets.has(entry.hash)));
 expect(packs).toHaveLength(6);
 expect(packs.flatMap(pack=>pack.entries.map(entry=>entry.hash)).sort()).toEqual([...hashes].sort());
 for(const pack of packs)expect(pack.entries).toHaveLength(1);
 expect(validateOutputProduct(directory).shard).toEqual(shard);
});

it('allows only installed public runtime packages and copied TypeScript targets',()=>{
 for(const name of ['three','three/webgpu','valibot','@wildshard/engine/app/scope','@wildshard/game/plugin/headless','@wildshard/sdk/headlessRuntime'])expect(runtimePackageAllowed(name),name).toBe(true);
 for(const name of ['node:fs','@wildshard/commons/trees','@wildshard/engine/not-public','three/package.json','@wildshard/sdk/bake?raw'])expect(runtimePackageAllowed(name),name).toBe(false);
 const directory=output();mkdirSync(resolve(directory,'runtime'));writeFileSync(resolve(directory,'runtime/other.ts'),'export const x=1;');
 expect(()=>validateRuntimeImports(directory,'runtime/index.ts',"import {x} from './other'; import type {Scope} from '@wildshard/engine/app/scope';")).not.toThrow();
 expect(()=>validateRuntimeImports(directory,'runtime/index.ts',"import x from '../data/x';")).toThrow();
 expect(()=>validateRuntimeImports(directory,'runtime/index.ts',"import x from './other.json';")).toThrow();
 expect(()=>validateRuntimeImports(directory,'runtime/index.ts',"import('node:fs');")).toThrow();
});

it('does not publish grid evidence before entry admission succeeds',()=>{
 const shard=source(),directory=output();
 const invalid={...shard,entryways:shard.entryways.map(({edge,at})=>({edge,at,width:7}))};
 expect(()=>writeOutputProduct(invalid,new Map(),directory)).toThrow(/entryway|8 metres/u);
 expect(existsSync(resolve(directory,'validation.json'))).toBe(false);
});
