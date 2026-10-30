// oxlint-disable-next-line import/no-nodejs-modules -- Check actual native spawn and continuation, never supplied output.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Load only the admitted product and unchanged native physics bytes.
import {readFileSync} from 'node:fs';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {canonicalSimDigest} from '../../fake/simState';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime,nalatiPatrolOf} from '../nalati-patrol-native';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';

const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
const descriptor=outputDescriptor(shard);assert.ok(descriptor);
const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm')),input={shard,assets,rapier,product};
const first=await createNativeProofResident(input,prepareHeadlessRuntime);
let restored:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
try{
  const owner=nalatiPatrolOf(first.host);assert.ok(owner);
  assert.equal(owner.law.riders.length,0,'the entry cannot pre-spawn its night patrol');
  assert.equal(owner.readiness.eligible,false,'the captain cannot start before the actual kill gate');
  const commands:HeadlessCommand[]=[{kind:'player',moveX:0,moveZ:0,yaw:0,commandVersion:1,crouch:true,steer:{keyX:0,keyY:0,stickX:0,stickY:0}}];
  // Natural fixed time, original day schedule and actual default entry only.
  // No input exists for night, roster creation, kills or readiness.
  for(let tick=0;tick<60_000&&owner.law.riders.length===0;tick++){
    first.step(commands);assert.equal(first.host.player.health.alive,true);
    assert.equal(owner.readiness.eligible,false);
    for(const effect of first.effects)assert.equal(effect.kind,'hint','waiting cannot grant quest completion or rewards');
  }
  assert.ok(owner.law.riders.length>0,'the original night cycle must select its own riders');
  assert.equal(first.host.dayClock?.dayPhase,'night');
  assert.equal(owner.law.killsTonight,0,'materializing actual riders cannot substitute for killing five');
  assert.ok(owner.law.riders.every(row=>row.a.alive));
  const spawnTick=first.host.state.tick;
  for(let tick=0;tick<120;tick++)first.step(commands);
  const saved=snapshotSimHost(first.host),digest=canonicalSimDigest(saved);
  restored=await createNativeProofResident(input,prepareHeadlessRuntime,serializeSimSnapshot(saved));
  assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)),digest,'an earned populated checkpoint restores quietly');
  const continued=nalatiPatrolOf(restored.host);assert.ok(continued);
  const observation=(resident:typeof first):unknown=>({
    patrol:resident.host.adapters.get('nalati.patrol')?.snapshot(),
    bodies:[...resident.host.entities].map(([id,body])=>[id,body.snapshot()]),
    rng:resident.host.rng.snapshot(),feet:resident.host.player.position.toArray(),health:resident.host.player.health.snapshot(),
  });
  for(let tick=0;tick<120;tick++){
    first.step(commands);restored.step(commands);
    assert.deepEqual(observation(restored),observation(first),'every native rider, pose, arrow, guest clock and RNG continues exactly');
  }
  assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)),canonicalSimDigest(snapshotSimHost(first.host)),'the complete native world retains the same continuation');
  assert.equal(owner.readiness.eligible,false);assert.equal(continued.readiness.eligible,false);
  assert.equal(owner.law.killsTonight,0);assert.equal(continued.law.killsTonight,0);
  assert.equal(first.host.player.health.alive,true);
  console.info(JSON.stringify({story:'nalati-night-patrol',spawnTick,riders:owner.law.riders.length,kills:owner.law.killsTonight,ready:owner.readiness.eligible}));
}finally{restored?.dispose();first.dispose();}
