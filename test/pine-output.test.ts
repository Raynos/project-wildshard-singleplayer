// oxlint-disable-next-line import/no-nodejs-modules -- Verify named guest content identities.
import {createHash} from 'node:crypto';
import {parseSpawnScript, SpawnScriptsSchema} from '@wildshard/format/spawnScripts';
import {parseEliteFeature} from '@wildshard/format/eliteFeature';
import { PINE_ELITES as elites } from './fixtures/pine-elites';
import {outputPlatformPayloads} from '../src/sdk/outputProduct';
import {HeldEquipmentSchema} from '@wildshard/format/heldEquipment';
import {expect,test} from 'vitest';
import * as v from 'valibot';
import director from '../src/shards/pine-hollow/data/director.json' with {type:'json'};
import {readPineProject} from './fixtures/pine-project';
import {ClaimedPickupSchema} from '@wildshard/format/lootEconomy';

const pine=await readPineProject();

test('Pine emits every client section with checked schemas and named immutable assets',()=>{
 const loaded=pine;
 expect(Object.hasOwn(loaded.output,'custom')).toBe(false);
 const names=loaded.output.namedFiles?.map(row=>row.name)??[];
 expect(names).toEqual(expect.arrayContaining(['models/held/crossbow-pool.glb','models/held/lever-details.glb','models/king/kit.glb','behaviour/night.wasm','behaviour/director.wasm']));
 const eliteRows=parseEliteFeature(elites),fights=eliteRows.fights;
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
 }
 expect(programs).toHaveLength(fights.length+1);
 // the night's spawn row is the one that is no elite's (its generated night.generated.json left with 1b5c94aff7's jobs)
 const night=programs.find(row=>!fights.some(fight=>fight.program.step===row.step));if(night===undefined)throw new Error('Missing night spawn row');
 for(const stem of ['night','director']){
  const module=stem==='night'
   ?parseSpawnScript(night).script.module.slice('blobs/wasm/'.length,-'.wasm'.length)
   :v.parse(v.object({module:v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u))}),director).module;
  const file=loaded.output.namedFiles?.find(row=>row.name===`behaviour/${stem}.wasm`);
  expect(file?.hash).toBe(module);
  expect(file?.path).toBe(`blobs/wasm/${module}.wasm`);
  const bytes=loaded.assets.get(module);
  if(bytes===undefined)throw new Error(`Missing ${stem} module bytes`);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(module);
 }
 expect(()=>v.parse(ClaimedPickupSchema,{bad:{}})).toThrow();
 expect(()=>v.parse(HeldEquipmentSchema.entries.launcher,{pool:{url:'missing',parts:[]},hierarchy:{}})).toThrow();
},30000);
