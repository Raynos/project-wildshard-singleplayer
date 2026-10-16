import { afterEach, expect, it } from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- The output validator fixture owns its generated directory.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files inside the owned output directory.
import { resolve } from 'node:path';
import { emptyShardfile } from '@wildshard/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { runtimePackageAllowed, validateRuntimeImports } from '../src/sdk/runtimeImports';
import { defineSection, emitDefinedSections } from '@wildshard/sdk/sections';
import { writeOutputProduct, validateOutputProduct } from '../src/sdk/outputProduct';
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
it('refuses canonical but schema-invalid section bytes with updated hash and size',()=>{
 const directory=output(),index=writeOutputProduct(source(),new Map(),directory);
 const entry=index.sections.find(row=>row.name==='world/spawn');if(entry===undefined)throw new Error('Missing spawn');
 const bytes=new TextEncoder().encode(encodeCanonicalJson({spawn:{x:'wrong',y:2,z:0,yaw:0}}));
 writeFileSync(resolve(directory,entry.path),bytes);entry.hash=hashImmutableBytes(bytes);entry.bytes=bytes.length;
 writeFileSync(resolve(directory,'shard.json'),encodeCanonicalJson(index));expect(()=>validateOutputProduct(directory)).toThrow();
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
