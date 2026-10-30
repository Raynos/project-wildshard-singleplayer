import assert from 'node:assert/strict';
import { HeadlessSimulation } from '../../../src/sdk/headless.ts';
import { emptyShardfile } from '../../../src/sdk/author.ts';
import { PhysicsRouteCursor } from '../../../src/sdk/headlessJourney.ts';
import { decodeSimSnapshotBytes } from '../../../src/engine/sim/snapshot.ts';
const source=emptyShardfile({slug:'journey-fixture',name:'Journey fixture',author:'Test',revision:1,seed:435});
const plan={ticks:30,points:[{x:source.spawn.x,z:source.spawn.z},{x:source.spawn.x+5,z:source.spawn.z}]};
const sim=await HeadlessSimulation.create(source,new Map(),undefined,{deadline:'advisory'});
const control=await HeadlessSimulation.create(source,new Map(),undefined,{deadline:'advisory'});
try {
  const entered=sim.checkpoint;
  await assert.rejects(sim.journey({...plan,ticks:1801}));
  assert.deepEqual(sim.checkpoint,entered,'invalid route admission must leave the real continuation intact');
  const cursor=new PhysicsRouteCursor(plan.points);
  let saved=decodeSimSnapshotBytes(control.checkpoint.snapshot);
  for(let tick=0;tick<plan.ticks;tick++)saved=decodeSimSnapshotBytes((await control.step([{source:'control',commands:[cursor.command(saved.player.position,tick)]}])).snapshot);
  for(let tick=0;tick<60;tick++)saved=decodeSimSnapshotBytes((await control.step()).snapshot);
  const report=await sim.journey(plan);
  assert.equal(report.ticks,30);assert.equal(report.settledTicks,60);
  assert.equal(report.final.tick,saved.state.tick);
  assert.deepEqual(report.final.position,saved.player.position,'terminal route must use exactly the normal native movement');
  assert.equal(report.final.grounded,saved.player.motor.result.grounded);
  assert.ok(report.distance>0);
  assert.deepEqual(sim.checkpoint,entered,'compact observations are not a resumable checkpoint');
  await assert.rejects(sim.step(),/validation finished/);
  await assert.rejects(sim.journey(plan),/already finished/);
} finally {await sim.dispose();await control.dispose();}
await assert.rejects(sim.step());
const live=await HeadlessSimulation.create(source,new Map());
try {await assert.rejects(live.journey(plan),/trusted offline timing/);assert.equal(live.checkpoint.tick,0);}
finally {await live.dispose();}
console.log('native journey parity, terminal disposal and runtime refusal pass');
