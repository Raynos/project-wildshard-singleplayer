// oxlint-disable-next-line import/no-nodejs-modules -- Read the current admitted product and shipped physics bytes.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Behavior assertions run in the bounded native child.
import assert from 'node:assert/strict';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {createNativeProofResident} from '../headless-native';
import {createNativeProofWorker} from '../headless-worker';
import {productHeadlessSections} from '../../../src/sdk/headlessSections';
import {installWalkRopeBodies} from './ropeBodies';
import {installNativeWalkBounds} from './nativeBounds';
import {prepareHeadlessRuntime} from '../../proof/driftwood-isle/worker';
import {playDriftwood} from '../../proof/driftwood-isle/tape';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeSegment} from '../../../src/sdk/headlessTape';

const journey=process.argv[2]??'sealed-ring';
if(journey!=='sealed-ring'&&journey!=='zipline')throw new Error('Unknown native Driftwood story');
const directory=builtProduct('driftwood-isle'),product=await loadHeadlessProduct(directory),source=product.shardfile;
const descriptor=outputDescriptor(source);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
  Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const resident=await createNativeProofResident({shard:source,assets,rapier,product},prepareHeadlessRuntime);
const releaseRopes=installWalkRopeBodies(resident.host,product);installNativeWalkBounds(resident.host);
const frames:HeadlessCommand[][]=[],marks:{id:string;tick:number;flags:string[]}[]=[];
try{
  // This authors inputs from actual feet/targets and pushes the barrel with
  // the player motor. It neither reads nor writes the historical goldens.
  await playDriftwood(resident.host,commands=>{
    if(frames.length>=60_000)throw new Error('Story exceeds the admitted tape allowance');
    frames.push(structuredClone(commands));resident.step(commands);
  },id=>{marks.push({id,tick:frames.length,flags:[...resident.host.flags.all]});return Promise.resolve();},journey);
  assert.ok(resident.host.flags.has(journey==='sealed-ring'?'quest:driftwood-done':'used:zipline'));
}finally{releaseRopes();resident.dispose();}

const replay=await createNativeProofWorker(source,assets,'driftwood',undefined,productHeadlessSections(product),directory);
try{
  const segments:HeadlessTapeSegment[]=[];let start=0;
  for(const mark of marks){
    while(mark.tick-start>18_000){
      segments.push({id:`walk-${start}`,ticks:18_000,commands:[],frames:frames.slice(start,start+18_000)});start+=18_000;
    }
    segments.push({id:mark.id,ticks:mark.tick-start,commands:[],frames:frames.slice(start,mark.tick)});start=mark.tick;
  }
  const report=await replay.verbTape({version:1,observe:[],segments});
  assert.equal(report.ticks,frames.length);
  for(const mark of marks){
    const actual=report.observations.find(row=>row.id===mark.id);assert.ok(actual);
    assert.deepEqual(actual.flags,mark.flags,'fresh current-command replay must retain actual earned transitions');
  }
  if(journey==='sealed-ring'){
    const complete=report.observations.find(row=>row.id==='complete');assert.ok(complete);
    for(const flag of ['talked:castaway','has:flint','lit:beacon','shard:lookout','dead:sailor','key:hold',
      'lever:hold-pump','winch:up','shard:wreck','open:sluice','shard:cave','used:altar','dead:captain','quest:driftwood-done'])assert.ok(complete.flags.includes(flag),flag);
  }else{
    for(const id of ['lookout','zipline-launch','zipline-mid']){
      const before=report.observations.find(row=>row.id===id);assert.ok(before);
      assert.equal(before.flags.includes('used:zipline'),false,'only real cable landing earns the feat');
    }
    const landed=report.observations.find(row=>row.id==='zipline-landed');assert.ok(landed);
    assert.ok(landed.flags.includes('used:zipline'));assert.equal(landed.flags.includes('quest:driftwood-done'),false);
  }
  assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:journey,ticks:report.ticks,marks:report.observations.map(row=>({id:row.id,tick:row.tick}))}));
}finally{await replay.dispose();}
