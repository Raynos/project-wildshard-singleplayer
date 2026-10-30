// oxlint-disable-next-line import/no-nodejs-modules -- Assert real native outcomes and their independent replay.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only the admitted product and actual physics bytes.
import {readFileSync} from 'node:fs';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {nativePopulationOf} from '../../../src/game/riding/nativePopulation';
import {runTrustedHeadlessTape} from '../../../src/sdk/headlessTape';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-predators-native';
import {beginProductSession} from './productSession';

const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
const descriptor=outputDescriptor(shard);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
  Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
const resident=await createNativeProofResident({shard,assets,rapier,product},prepareHeadlessRuntime);
let replay:Awaited<ReturnType<Awaited<ReturnType<typeof beginProductSession>>['ready']>>|undefined;
try{
  const population=nativePopulationOf(resident.host);assert.ok(population);
  const flock=population.flocks[0];assert.ok(flock);
  const sheep=flock.alive,originalWolves=[...resident.host.entities.values()].filter(actor=>actor.kind==='wolf').map(actor=>actor.entityId);
  const delay=population.raid.snapshot().state.raidT;assert.ok(delay>0);
  runTrustedHeadlessTape(resident.host,commands=>resident.step(commands),()=>resident.effects,{version:1,observe:[],segments:[{
    id:'walk-and-jump-to-pasture',ticks:6000,commands:[],route:[{x:-10,z:232,jump:true,jumpAt:6},{x:-30,z:228},{x:-60,z:222},{x:-100,z:212}],
  }]});
  const arrivalTick=resident.host.state.tick;
  assert.ok(Math.hypot(resident.host.player.position.x-flock.cx,resident.host.player.position.z-flock.cz)<30);
  for(let tick=0;tick<18_000&&population.raid.snapshot().state.raidT>.2;tick++)resident.step([]);
  assert.equal(population.raid.raids,0,'the checkpoint precedes the actual scheduled raid');
  assert.ok(population.raid.snapshot().state.raidT<=.2,'the real clock reaches its scheduled attempt');
  const checkpoint=serializeSimSnapshot(snapshotSimHost(resident.host)),checkpointTick=resident.host.state.tick;
  const pending=await beginProductSession('nalati-grasslands','nalati-predators',checkpoint);
  replay=await pending.ready();
  const report=runTrustedHeadlessTape(resident.host,commands=>resident.step(commands),()=>resident.effects,{version:1,observe:['nalati.predators'],segments:[{
    id:'ordinary-raid-and-shepherd-defense',ticks:1800,commands:[],
  }]});
  assert.equal(population.raid.raids,1);assert.equal(population.raid.raiding,false);
  assert.equal(population.raid.taken,0);assert.equal(population.raid.drivenOff,1);assert.ok(population.raid.cracks>0);
  assert.equal(flock.alive,sheep,'the actual shepherd preserves the living flock');
  assert.ok(population.raid.shepherd?.alive);assert.equal(resident.host.player.health.alive,true);
  const raiders=[...resident.host.entities.values()].filter(actor=>actor.kind==='wolf'&&!originalWolves.includes(actor.entityId));
  assert.ok(raiders.length>0,'only the ordinary raid allocates the real raiders');
  const repeated=await replay.verbTape({version:1,observe:['nalati.predators'],segments:[{
    id:'ordinary-raid-and-shepherd-defense',ticks:1800,commands:[],
  }]});
  assert.deepEqual(repeated,report,'the earned pre-raid checkpoint reproduces real actors, flock, signals and outcome in a fresh worker');
  assert.equal(replay.quarantined,false);
  console.info(JSON.stringify({story:'native-flock-raid',arrivalTick,checkpointTick,firstRaidSeconds:delay,
    ticks:resident.host.state.tick,sheep:flock.alive,raiders:raiders.length,cracks:population.raid.cracks,drivenOff:population.raid.drivenOff}));
}finally{resident.dispose();await replay?.dispose();}
