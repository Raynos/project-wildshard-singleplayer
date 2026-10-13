// oxlint-disable-next-line import/no-nodejs-modules -- Owned isolated source-registry fixtures only.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve literal fixture-owned paths.
import { dirname, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { generatorInventory, writeGeneratorInventory, GENERATOR_INVENTORY } from '../scripts/generator-inventory.mjs';

it('reads literal, wrapped and mapped explorer registries without executing builders or module side effects',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'explorer-generators-'));
  const put=(file:string,source:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),source);};
  const entry='src/shards/sample/generators/tree.ts',trusted='src/shards/sample/generators/old.ts';
  try{
    put(entry,"export const geometry = {kind:'tree'}; throw new Error('author must not execute');");
    put(trusted,"import '../../../game/install.ts';export const old = {}; throw new Error('runtime must not execute');");
    put('src/game/install.ts',"throw new Error('service must not execute');");
    put('src/shards/sample/models/tree.ts',`const FILE='${entry}';const LABELS={tree:'Tree'};export const tree=defineModel(baked({id:'sample/tree',name:LABELS.tree,file:FILE}));export const old=defineModel({id:'sample/old',name:'Old',file:'${trusted}'});`);
    put('src/shards/sample/world/sets.ts',"const SETS=[{id:'sample/grove',name:'Grove',place:'sample/grove'}];for(const row of SETS)placeSet(row);throw new Error('world must not execute');");
    put('src/shards/sample/data/places.ts',"export const PLACES=[{id:'grove',label:'GROVE'},{id:'pond',label:'POND'}];");
    put('src/shards/sample/manifest.ts',"import {PLACES} from './data/places';export const manifest={pois:PLACES.map(({id,label})=>({id,name:label.charAt(0)+label.slice(1).toLowerCase()}))};");
    put('src/shards/sample/data/pieces.ts',`const FILE='${entry}';export const PIECES=['a','b'].map(id=>({id:\`part-\${id}\`,name:id,file:FILE}));`);
    put('src/shards/sample-legacy/models/dead.ts',"export const old=defineModel({id:'sample/dead',name:'Frozen',file:'src/shards/sample-legacy/models/dead.ts'});");
    put('scripts/generation-jobs.json',JSON.stringify({schema:'generation-jobs/1',notice:'DO NOT EDIT',jobs:[entry,trusted].map((file,index)=>({id:index===0?'tree':'old',shard:'sample',entry:file,command:[file],inputRoots:[file],outputs:[`public/output-${index}.json`],platform:'portable'}))}));
    const inventory=generatorInventory(root);
    expect(inventory.rows.find(row=>row.id==='sample/tree')).toMatchObject({name:'Tree',status:'generator in shard folder'});
    expect(inventory.rows.find(row=>row.id==='sample/old')).toMatchObject({status:'runtime-in-Node bake'});
    expect(inventory.rows.filter(row=>row.explorer==='Set').map(row=>row.id)).toEqual(['sample/grove']);
    expect(inventory.rows.filter(row=>row.explorer==='World').map(row=>row.name)).toEqual(['Grove','a','b','Pond']);
    expect(inventory.rows.some(row=>row.id==='sample/dead')).toBe(false);
    expect(inventory.totals).toEqual([{shard:'sample',ported:3,left:4,portedLines:1,leftLines:3,explorers:{Model:2,Set:1,World:4}}]);
    expect(inventory.gaps).toEqual([]);
    writeGeneratorInventory(root);const first=readFileSync(resolve(root,GENERATOR_INVENTORY));writeGeneratorInventory(root);
    expect(readFileSync(resolve(root,GENERATOR_INVENTORY))).toEqual(first);
  }finally{rmSync(root,{recursive:true,force:true});}
});
