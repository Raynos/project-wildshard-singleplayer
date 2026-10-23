import {expect,test} from 'vitest';
import * as v from 'valibot';
import metadata from '../src/shards/nalati-grasslands/manifest.json' with {type:'json'};
import {parseManifestMetadata} from '../src/format/minimap';
import {parseClientPlan} from '../src/format/clientPlan';
import {CLIENT_FEATURES} from '../src/game/shardfile/clientPlan';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {outputPlatformPayloads} from '../src/sdk/outputProduct';
import {readProjectAssets} from '../src/sdk/project';

test('the native plan constructs the original elite and night owners once after assembly',async()=>{
  const emitted=await readProjectAssets('src/shards/nalati-grasslands');
  const files=new Map((emitted.output.namedFiles??[]).flatMap(file=>file.name===undefined?[]:[[file.name,{...file,url:file.path}] as const]));
  const product=createShardProduct({slug:emitted.shard.identity.slug,revision:emitted.shard.identity.revision,shardfile:emitted.shard,
    sections:outputPlatformPayloads(emitted.output.platform,['client/plan']),files,
    read:hash=>{const bytes=emitted.assets.get(hash);if(bytes===undefined)throw new Error('Missing admitted constructor input');return Promise.resolve(bytes);}});
  const plan=parseClientPlan(product.section('client/plan')),entry=parseManifestMetadata(metadata).bindings.entry;
  if(entry===undefined||!('native' in entry))throw new Error('Missing native entry');
  const selection=entry.nativePlan;
  if(typeof selection!=='object'||selection.features===undefined)throw new Error('Missing native feature selection');
  const nativeKinds=new Set<string>(selection.features),selected=plan.features.filter(row=>nativeKinds.has(row.kind));
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
