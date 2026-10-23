// oxlint-disable-next-line import/no-nodejs-modules -- Pin original guest and metadata parity.
import {createHash} from 'node:crypto';
import {parseSpawnScript, SpawnScriptsSchema} from '../src/format/spawnScripts';
import {parseEliteFeature} from '../src/format/eliteFeature';
import elites from '../src/shards/pine-hollow/behaviour/elites.generated.json' with {type:'json'};
import {outputPlatformPayloads} from '../src/sdk/outputProduct';
import {HeldEquipmentSchema} from '../src/format/heldEquipment';
import {expect,test} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the official emitted author output, not a runtime filesystem path.
import {readFileSync} from 'node:fs';
import {readProjectAssets} from '../src/sdk/project';
import {validateDefinedSection} from '../src/sdk/sections';
import {SECTIONS} from '../src/shards/pine-hollow/generators/sectionSchemas.generated';
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
 const eliteRows=parseEliteFeature(elites),fights=eliteRows.fights;
 expect(createHash('sha256').update(JSON.stringify(eliteRows)).digest('hex')).toBe('624f2098b594cc8c45ed8e829beccdd57c84c4d7d55ab64656df9d126ef2df0c');
 const original=structuredClone(eliteRows);
 expect(fights.map(fight=>fight.def.id).sort()).toEqual(['blackpaw','ghost-stag','imperial-bull','ironhide']);
 const programs=v.parse(SpawnScriptsSchema,outputPlatformPayloads(loaded.output.platform,['actors/spawn-scripts']).get('actors/spawn-scripts'));
 for(const fight of fights){
  const file=loaded.output.namedFiles?.find(row=>row.name===`behaviour/elites/${fight.def.id}.wasm`);
  expect(file?.path).toBe(fight.program.script.module);
  expect(file?.hash).toBe(fight.program.script.module.slice('blobs/wasm/'.length,-'.wasm'.length));
  expect(programs.find(row=>row.step===fight.program.step)).toEqual({...fight.program,bytes:''});
  expect(fight.program.bytes).toBe('');
  const bytes=loaded.assets.get(file?.hash??'');
  if(bytes===undefined)throw new Error('Missing named elite executable');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(file?.hash);
  const old=original.fights.find(row=>row.def.id===fight.def.id);
  if(old===undefined)throw new Error('Missing original elite row');
  old.program.bytes=Buffer.from(bytes).toString('base64');
 }
 expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('ee905315c2bf2084e2ae07e41f1c1c616927c0e09ff4b2f8474c535a190c125d');
 expect(programs).toHaveLength(fights.length+1);
 for(const stem of ['night','director']){
  const originalRows:unknown=JSON.parse(readFileSync(`src/shards/pine-hollow/behaviour/${stem==='night'?'night.generated':stem}.json`,'utf8'));
  const module=stem==='night'
   ?parseSpawnScript(originalRows).script.module.slice('blobs/wasm/'.length,-'.wasm'.length)
   :v.parse(v.object({module:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))}),originalRows).module;
  const file=loaded.output.namedFiles?.find(row=>row.name===`behaviour/${stem}.wasm`);
  expect(file?.hash).toBe(module);
 }
 expect(()=>v.parse(ClaimedPickupSchema,{bad:{}})).toThrow();
 expect(()=>v.parse(HeldEquipmentSchema.entries.launcher,{pool:{url:'missing',parts:[]},hierarchy:{}})).toThrow();
},30000);
