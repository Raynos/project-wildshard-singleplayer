// oxlint-disable-next-line import/no-nodejs-modules -- Load the admitted product and original native physics module.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Assert actual native ownership and checkpoint continuation.
import assert from 'node:assert/strict';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {snapshotSimHost,serializeSimSnapshot} from '../../../src/engine/sim/snapshot';
import {nativeTamingOf} from '../../../src/game/riding/nativeTaming';
import {mountedPlayerOf} from '../../../src/game/riding/native';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-headless';
import {canonicalSimDigest} from '../../fake/simState';
import {walkNalatiHorsePlains} from '../../proof/nalati-grasslands/horsePlainsWalk';
import {createNalatiTamingPilot} from '../../proof/nalati-grasslands/tamingPilot';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';

/** The real entry, physical approach and every bucking round. A checkpoint
 * is captured from accepted live state, never supplied by the caller. */
export async function runNalatiFieldTaming():Promise<{ticks:number;approachTicks:number;breakingTicks:number;checkpointTick:number;rounds:number}> {
  const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),shard=product.shardfile;
  const descriptor=outputDescriptor(shard);assert.ok(descriptor);
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
    Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const preparation={shard,assets,rapier,product},first=await createNativeProofResident(preparation,prepareHeadlessRuntime);
  let restored:Awaited<ReturnType<typeof createNativeProofResident>>|undefined;
  try{
    const taming=nativeTamingOf(first.host),mounted=mountedPlayerOf(first.host);assert.ok(taming);assert.ok(mounted);
    assert.equal(first.host.player.position.x,shard.spawn.x);assert.equal(first.host.player.position.z,shard.spawn.z);
    const original=[...first.host.entities.values()].find(actor=>actor.kind==='horse'&&actor.variant==='stallion');assert.ok(original);
    let inputs=0;
    const step=(commands:readonly HeadlessCommand[]):void=>{
      assert.ok(inputs++<20_000,'the input route must stay within its finite allowance');first.step(commands);
      assert.deepEqual(first.effects,[],'walking or taming cannot mint quest completion facts');
    };
    walkNalatiHorsePlains(first.host,step);const approachTicks=first.host.state.tick;
    const pilot=createNalatiTamingPilot();let prompt=false,breakingTicks=0,checkpointTick=0,rounds=0;
    for(let tick=0;tick<6000&&taming.phase!=='bonded';tick++){
      const commands=pilot(first.host,original.entityId);
      prompt ||= taming.interactable.radius>0;
      if(taming.phase==='breaking'){breakingTicks++;rounds=Math.max(rounds,taming.view.round??0);}
      step(commands);restored?.step(commands);
      if(restored===undefined&&taming.phase==='breaking'&&breakingTicks===250){
        const saved=snapshotSimHost(first.host);checkpointTick=first.host.state.tick;
        restored=await createNativeProofResident(preparation,prepareHeadlessRuntime,serializeSimSnapshot(saved));
        assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)),canonicalSimDigest(saved),'the earned mid-round checkpoint restores quietly');
      }
    }
    assert.equal(prompt,true);assert.equal(rounds,5);assert.equal(taming.phase,'bonded');assert.ok(restored);
    assert.equal(taming.companion?.variant,'tulpar');assert.equal(mounted.horse,taming.companion);
    assert.equal(original.alive,true);assert.equal(first.host.entities.get(original.entityId),original);
    assert.equal(original.position.y,-1e4);assert.equal(original.motor,null);
    assert.equal(canonicalSimDigest(snapshotSimHost(restored.host)),canonicalSimDigest(snapshotSimHost(first.host)),
      'the complete actual bucking/adoption suffix survives reinstall');
    return {ticks:first.host.state.tick,approachTicks,breakingTicks,checkpointTick,rounds};
  }finally{restored?.dispose();first.dispose();}
}
