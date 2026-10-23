import {expect,test} from 'vitest';
import * as v from 'valibot';
import metadata from '../src/shards/nalati-grasslands/manifest.json' with {type:'json'};
import {parseManifestMetadata} from '../src/format/minimap';
import {parseClientPlan} from '../src/format/clientPlan';
import {ForestWeatherSchema} from '../src/format/forestWeather';
import {ArenaScriptFightFileSchema} from '../src/format/arenaScriptRows';
import {CLIENT_FEATURES} from '../src/game/shardfile/clientPlan';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {outputPlatformPayloads} from '../src/sdk/outputProduct';
import {readProjectAssets} from '../src/sdk/project';

test('the declared plan constructs the original elite and night owners once after assembly',async()=>{
  const emitted=await readProjectAssets('src/shards/nalati-grasslands');
  const files=new Map((emitted.output.namedFiles??[]).flatMap(file=>file.name===undefined?[]:[[file.name,{...file,url:file.path}] as const]));
  const product=createShardProduct({slug:emitted.shard.identity.slug,revision:emitted.shard.identity.revision,shardfile:emitted.shard,
    sections:outputPlatformPayloads(emitted.output.platform,['client/plan']),files,
    read:hash=>{const bytes=emitted.assets.get(hash);if(bytes===undefined)throw new Error('Missing admitted constructor input');return Promise.resolve(bytes);}});
  const plan=parseClientPlan(product.section('client/plan')),entry=parseManifestMetadata(metadata).bindings.entry;
  expect(entry).toEqual({platform:'client-plan',retainHomeRuntime:true,stagesOwner:'declared'});
  const runtime=product.shardfile.runtime;
  if(runtime===null||'entry' in runtime)throw new Error('Missing declared runtime');
  expect(runtime.kind).toBe('client-plan');
  const selected=plan.features;
  expect(selected.find(row=>row.kind==='population.wildlife')).toMatchObject({publish:'wildlife'});
  const debug=selected.filter(row=>row.kind==='debug.expose');
  expect(debug.find(row=>row.name==='harness.shard.nalati-grasslands')).toMatchObject({objects:['ride','wildlife']});
  expect(debug.some(row=>row.name==='nalati')).toBe(false);
  const weather=selected.find(row=>row.kind==='weather.forest');
  if(weather===undefined)throw new Error('Missing declared weather owner');
  const weatherRows=v.parse(ForestWeatherSchema,await product.json(weather.file));
  expect(weatherRows.debug).toBe('nalati.weather');
  expect(debug.some(row=>row.name===weatherRows.debug)).toBe(false);
  const assembly=selected.find(row=>row.kind==='world.assembly');
  const titan=assembly?.rows.stages.find(row=>row.kind==='arena-room'&&'files' in row);
  if(titan?.kind!=='arena-room'||!('files' in titan))throw new Error('Missing declared open arena');
  const fight=v.parse(ArenaScriptFightFileSchema,await product.json(titan.files.fight));
  expect(fight.arenaScript.view.debug).toBe('nalati.titan');
  expect(debug.some(row=>row.name===fight.arenaScript.view.debug)).toBe(false);
  for(const [name,kind,owner] of [['nalati.boss','arena-room','nalati.king'],['nalati.elites','elite-entry','nalati.elites']])
    expect(debug.find(row=>row.name===name)).toMatchObject({source:{kind,owner}});
  const constructors=selected.filter(row=>row.kind==='elite.construct'||row.kind==='timed.encounters');
  const {constants}=v.parse(v.object({constants:v.object({eliteEntry:v.unknown(),timedEntry:v.unknown()})}),await product.json('sim/headless-assembly.json'));
  expect(constructors).toEqual([constants.eliteEntry,constants.timedEntry]);
  expect(selected.filter(row=>row.kind==='world.assembly')).toHaveLength(1);
  expect(selected.filter(row=>row.kind==='elite.entry')).toHaveLength(1);
  expect(selected.filter(row=>row.kind==='stealth.entry')).toHaveLength(1);
  expect(CLIENT_FEATURES['world.assembly']).toMatchObject({phase:'world',rank:70});
  expect(CLIENT_FEATURES['elite.construct']).toMatchObject({phase:'world',rank:75,needsWorldLooks:false});
  expect(CLIENT_FEATURES['timed.encounters']).toMatchObject({phase:'world',rank:80,needsWorldLooks:false});
  expect(CLIENT_FEATURES['stealth.entry'].phase).toBe('prepare-play');
  expect(CLIENT_FEATURES['elite.entry'].phase).toBe('play');
});
