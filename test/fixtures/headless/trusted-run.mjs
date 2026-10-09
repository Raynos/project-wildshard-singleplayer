import assert from 'node:assert/strict';
import { HeadlessSimulation } from '../../../src/sdk/headless.ts';
import { emptyShardfile } from '../../../src/sdk/author.ts';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot.ts';
const source = emptyShardfile({slug:'trusted-fixture',name:'Trusted fixture',author:'Test',revision:1,seed:435});
const options = {deadline:'advisory',trustedRuntime:{module:new URL('./trustedRuntime.ts',import.meta.url).href}};
const sim = await HeadlessSimulation.create(source,new Map(),undefined,options);
try {
  let checkpoint;
  for(let tick=0;tick<10;tick++) checkpoint=await sim.step([{source:'input',commands:[{kind:'player',moveX:0,moveZ:0,yaw:0,...(tick===0?{attack:{targetId:'fixture.actor'}}:{})}]}]);
  assert.ok(checkpoint);
  const saved=decodeSimSnapshot(checkpoint.snapshot);
  assert.equal(saved.entities.length,1);
  assert.ok((saved.entities[0]?.state.motion.hp??100)<100,'real combat must damage the actual actor');
  const fresh=await HeadlessSimulation.create(source,new Map(),checkpoint.snapshot,options);
  try {
    let rewards=0;
    for(let tick=0;tick<30;tick++) {
      const commands=[{source:'fixture',commands:[{kind:'script',actorId:'fixture.actor',value:tick}]}];
      const a=await sim.step(commands),b=await fresh.step(commands);
      assert.deepEqual(a,b,'complete native and controller continuation must replay exactly');
      rewards+=a.effects.filter(effect=>effect.kind==='coins').length;
    }
    assert.equal(rewards,1);
    await assert.rejects(fresh.finish(),/no entry proof/);
  } finally {await fresh.dispose();}
  await assert.rejects(HeadlessSimulation.create(source,new Map(),undefined,{trustedRuntime:{module:'https://example.com/runtime.js'}}),/local file module/);
  await assert.rejects(HeadlessSimulation.create(source,new Map(),undefined,{...options,trustedRuntime:{module:new URL('../../../src/sdk/version.ts',import.meta.url).href}}),/must export prepareHeadlessRuntime/);
  console.log(JSON.stringify({nativeActors:1,damaged:true,suffixTicks:30,exact:true,rewards:1,entryProofRefused:true,invalidModuleRefused:true}));
} finally {await sim.dispose();}
