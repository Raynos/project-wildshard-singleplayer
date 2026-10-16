// oxlint-disable-next-line import/no-nodejs-modules -- Small owned output-only fixtures exercise publication refusal.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture products live beneath the owned tmp root.
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { nameBlob } from '@wildshard/sdk/blobs';
import { writeCatalogFromOutputs, type CatalogPlacement } from '@wildshard/sdk/outputCatalogScan';
import metadata from '../src/shards/far-reach/manifest.json';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root,{recursive:true,force:true}); });
function outputRoot(): string { mkdirSync(resolve('tmp'),{recursive:true});const folder=mkdtempSync(resolve('tmp/catalog-scan-'));owned.push(folder);return folder; }
function put(root: string,path:string,bytes:string|Uint8Array):void {const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
function product(root:string,folder:string,order:number):CatalogPlacement {
  const source=emptyShardfile({slug:folder,name:folder,author:'Test',revision:1,seed:1});
  const image=nameBlob('ui/card','image',Uint8Array.from(readFileSync('test/fixtures/world-source/image.png')));
  const url=`/shardfiles/${folder}/${image.file.path}`;
  const level={manifest:{...metadata,slug:folder,name:folder,order,card:{thumb:url,portrait:url,landscape:url}}};
  const sections=[['ui/level',level],['ui/card',{accent:'pink'}]] as const;
  const index={format:'wildshard.shardfile',formatVersion:2,sdk:'0.2',version:source.version,identity:source.identity,requires:source.requires,
    build:{sourceHash:'0'.repeat(64),validator:'test'},admission:{budgets:source.budgets,serverBudget:source.serverBudget,authorCaps:source.authorCaps,critical:source.critical,library:source.library},
    sections:sections.map(([name,value])=>{const bytes=new TextEncoder().encode(encodeCanonicalJson(value)),path=`sections/${name}.json`;put(root,`${folder}/${path}`,bytes);return{name,path,schema:`wildshard:${name}@1`,hash:hashImmutableBytes(bytes),bytes:bytes.length};}),
    schemas:[],files:[image.file],runtime:null};
  put(root,`${folder}/${image.file.path}`,image.bytes);
  const bytes=new TextEncoder().encode(encodeCanonicalJson(index));put(root,`${folder}/shard.json`,bytes);
  put(root,`${folder}/validation.json`,JSON.stringify({indexHash:hashImmutableBytes(bytes)}));
  return{slug:folder,placement:{instance:folder,grid:[order,0],size:[500,500,500]}};
}
it('regenerates all output directories with exact index hashes and no source manifest',()=>{
  const directory=outputRoot(),placements=[product(directory,'beta',2),product(directory,'alpha',1)];
  const catalog=writeCatalogFromOutputs(directory,placements);
  expect(catalog.shards.map(entry=>entry.slug)).toEqual(['alpha','beta']);
  const entry=catalog.shards[0];if(entry===undefined)throw new Error('Catalog entry missing');
  expect(entry.index.hash).toBe(hashImmutableBytes(Uint8Array.from(readFileSync(join(directory,'alpha/shard.json')))));
  expect(entry.card.thumb).toMatch(/^alpha\/blobs\/image\/[a-f0-9]{64}\.png$/u);
  expect(entry.runtime).toBeNull();
  const first=readFileSync(join(directory,'catalog.json'),'utf8');writeCatalogFromOutputs(directory,[...placements].reverse());
  expect(readFileSync(join(directory,'catalog.json'),'utf8')).toBe(first);
});
it('refuses stale discovery bytes and receipts before replacing the old catalog',()=>{
  const directory=outputRoot(),placements=[product(directory,'alpha',1)];writeCatalogFromOutputs(directory,placements);
  const before=readFileSync(join(directory,'catalog.json'),'utf8'),path=join(directory,'alpha/sections/ui/level.json');
  writeFileSync(path,'{}');expect(()=>writeCatalogFromOutputs(directory,placements)).toThrow('section hash');
  expect(readFileSync(join(directory,'catalog.json'),'utf8')).toBe(before);
  product(directory,'alpha',1);writeFileSync(join(directory,'alpha/validation.json'),'{}');
  expect(()=>writeCatalogFromOutputs(directory,placements)).toThrow('current validated index');
  expect(readFileSync(join(directory,'catalog.json'),'utf8')).toBe(before);
});
it('refuses missing placements and incomplete directories without publishing a partial list',()=>{
  const directory=outputRoot(),placement=product(directory,'alpha',1);
  expect(()=>writeCatalogFromOutputs(directory,[])).toThrow('grid placement');
  expect(()=>writeCatalogFromOutputs(directory,[placement,placement])).toThrow('Duplicate');
  mkdirSync(join(directory,'incomplete'));
  expect(()=>writeCatalogFromOutputs(directory,[placement])).toThrow();
});
it('refuses an omitted declared output instead of publishing a partial catalog',()=>{
  const directory=outputRoot(),alpha=product(directory,'alpha',1);writeCatalogFromOutputs(directory,[alpha]);
  const before=readFileSync(join(directory,'catalog.json'),'utf8');
  expect(()=>writeCatalogFromOutputs(directory,[alpha,{slug:'beta',placement:{instance:'beta',grid:[2,0],size:[500,500,500]}}])).toThrow('every declared output');
  expect(readFileSync(join(directory,'catalog.json'),'utf8')).toBe(before);
});
