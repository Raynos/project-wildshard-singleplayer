import {parseSpawnScript} from '../src/format/spawnScripts';
import {HeldEquipmentSchema} from '../src/format/heldEquipment';
import {expect,test} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the official emitted author output, not a runtime filesystem path.
import {readFileSync} from 'node:fs';
import {readProjectAssets} from '../src/sdk/project';
import {validateDefinedSection} from '../src/sdk/sections';
import {SECTIONS} from '../src/shards/pine-hollow/runtime/sections';
import {ClaimedPickupSchema} from '../src/format/lootEconomy';

test('Pine emits every client section with checked schemas and named immutable assets',async()=>{
 const loaded=await readProjectAssets('src/shards/pine-hollow'),custom=loaded.output.custom;
 expect(custom).toBeDefined();
 if(custom===undefined)throw new Error('Pine custom sections absent');
 console.info('Pine custom section bytes',custom.sections.reduce((sum,row)=>sum+row.bytes,0));
 expect(custom.sections.map(row=>row.name).sort()).toEqual(Object.keys(SECTIONS).sort());
 const runtime:Readonly<Record<string,v.GenericSchema>>=SECTIONS;
 for(const row of custom.sections){
  const bytes=custom.files.get(row.path),schema=custom.files.get(row.schema),check=runtime[row.name];
  if(bytes===undefined||schema===undefined||check===undefined)throw new Error('Missing Pine section contract');
  const value:unknown=JSON.parse(new TextDecoder().decode(bytes));
  validateDefinedSection(schema,value);v.parse(check,value);
 }
 const names=loaded.output.namedFiles?.map(row=>row.name)??[];
 expect(names).toEqual(expect.arrayContaining(['models/held/crossbow-pool.glb','models/held/lever-details.glb','models/king/kit.glb','behaviour/night.wasm','behaviour/director.wasm']));
 for(const stem of ['ironhide','ghostStag','blackpaw','imperialBull','night','director']){
  const original:unknown=JSON.parse(readFileSync(`src/shards/pine-hollow/behaviour/${stem==='night'?'night.generated':stem}.json`,'utf8'));
  const module=stem==='night'
   ?parseSpawnScript(original).script.module.slice('blobs/wasm/'.length,-'.wasm'.length)
   :v.parse(v.object({module:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))}),original).module;
  const file=loaded.output.namedFiles?.find(row=>row.name===`behaviour/${stem}.wasm`);
  expect(file?.hash).toBe(module);
 }
 expect(()=>v.parse(ClaimedPickupSchema,{bad:{}})).toThrow();
 expect(()=>v.parse(HeldEquipmentSchema.entries.launcher,{pool:{url:'missing',parts:[]},hierarchy:{}})).toThrow();
},30000);
