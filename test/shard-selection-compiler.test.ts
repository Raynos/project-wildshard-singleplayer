import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own the tiny real compiler fixture and remove it after use.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the owned compiler fixture.
import {resolve} from 'node:path';
import {selectionCatalogueSource,selectionModules} from '../scripts/title-catalogue.mjs';
import {bootModuleFiles} from '../scripts/app-build/bootModules';
import {writtenBundle} from '../scripts/app-build/writtenBundle';
import {buildWithBootModules} from './fixtures/written-build';
import {readModuleFiles} from '../src/engine/boot/download';
import {catalogueManifests,titleManifests,titleMetadata,installTitleManifests} from '../src/game/shard/titleList';
import {shards,installShards,legacyContentIdentity} from '../src/game/shard/list';
import {saveCards} from '../src/game/savesSettings';

test('one selected discovery graph excludes other worlds and full catalogue bytes',async()=>{
 mkdirSync('tmp/shard-selection',{recursive:true});const root=mkdtempSync(resolve('tmp/shard-selection/compiler-'));
 try{
  for(const path of ['src/shards/first','src/shards/second','src/game/shardfile','src/game/grid'])mkdirSync(resolve(root,path),{recursive:true});
  writeFileSync(resolve(root,'index.html'),'<html><head></head><body><script type="module" src="/src/entry.ts"></script></body></html>');
  writeFileSync(resolve(root,'src/shards/first/manifest.ts'),'export default {slug:"first",name:"The first world"};');
  writeFileSync(resolve(root,'src/shards/second/manifest.ts'),'export default {slug:"second",name:"The second world"};');
  const selected=selectionModules(root);
  expect(selected.map(row=>row.slug)).toEqual(['first','second']);
  const source=selectionCatalogueSource(selected.map(row=>({slug:row.slug,file:row.file,placement:{grid:[1,2] as const,size:[500,500,500] as const,instance:`${row.slug}-solo`}})));
  writeFileSync(resolve(root,'src/selection.ts'),source);
  writeFileSync(resolve(root,'src/shardList.ts'),'import first from "./shards/first/manifest";import second from "./shards/second/manifest";export const all=[first,second];');
  writeFileSync(resolve(root,'src/entry.ts'),`import {SHARD_LOADERS} from './selection';
    window.loadWorld=slug=>SHARD_LOADERS[slug]();window.full=()=>import('./shardList');
    window.client=()=>import('./game/shardfile/client');window.grid=()=>import('./game/grid/session');
    async function startSelected(){return (await import('./first')).ready;}void startSelected();`);
  writeFileSync(resolve(root,'src/first.ts'),'export const ready=true;');
  writeFileSync(resolve(root,'src/game/shardfile/client.ts'),'export const ready=true;');
  writeFileSync(resolve(root,'src/game/grid/session.ts'),'export const ready=true;');
  const outDir=await buildWithBootModules(root),bundle=writtenBundle(outDir,root);
  const match=/<script type="application\/json" id="boot-module-files">([^<]+)<\/script>/u.exec(readFileSync(resolve(outDir,'index.html'),'utf8'));
  if(match?.[1]===undefined)throw new Error('Missing module facts');
  const facts:unknown=JSON.parse(match[1]);
  if(typeof facts!=='object'||facts===null)throw new Error('Missing module banks');
  const banks:unknown=Reflect.get(facts,'selection');if(typeof banks!=='object'||banks===null)throw new Error('Missing selections');
  const first=readModuleFiles(Reflect.get(banks,'first')),second=readModuleFiles(Reflect.get(banks,'second'));
  expect(first).toEqual(bootModuleFiles(bundle,[resolve(root,'src/shards/first/manifest.ts')]));
  expect(second).toEqual(bootModuleFiles(bundle,[resolve(root,'src/shards/second/manifest.ts')]));
  expect(first.some(([url])=>second.some(([other])=>url===other))).toBe(false);
  const catalogue=readModuleFiles(Reflect.get(facts,'catalogue')),common=readModuleFiles(Reflect.get(facts,'common'));
  for(const row of [...first,...second]){expect(catalogue).toContainEqual(row);expect(common).not.toContainEqual(row);}
  expect(Object.values(bundle).filter(file=>file.type==='chunk').some(file=>(file.code??'').includes('first-solo')&&(file.code??'').includes('placement'))).toBe(true);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('selected manifests override scalar cards while every save and pack policy stays available',()=>{
 const prepared=shards(),previous=titleManifests(),metadata=prepared.map(titleMetadata),selected=prepared[0];
 if(selected===undefined)throw new Error('Missing generated discovery');
 const content=Object.fromEntries(prepared.flatMap(row=>{const primary=legacyContentIdentity(row.slug);return primary===undefined?[]:[[row.slug,primary]];}));
 try{
  installTitleManifests(metadata);installShards([selected]);
  const catalogue=catalogueManifests();
  expect(catalogue.find(row=>row.slug===selected.slug)).toBe(selected);
  expect(catalogue.map(row=>row.slug)).toEqual(prepared.map(row=>row.slug));
  for(const developer of [false,true])expect(saveCards(catalogue,developer)).toEqual(saveCards(prepared,developer));
  for(const row of prepared){const card=catalogue.find(candidate=>candidate.slug===row.slug);expect(card?.bag).toEqual(row.bag);}
 }finally{installShards(prepared,content);installTitleManifests(previous);}
});
