import { strict as assert } from 'node:assert';
import { emptyShardfile } from '@wildshard/sdk/author';
import { HeadlessSimulation, validateSimulation } from '@wildshard/sdk/headless';
import { assetOverdraw } from '@wildshard/sdk/assets';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/sdk/admission';
const source = emptyShardfile({slug:'outside-worker',name:'Outside worker',author:'Local',revision:1,seed:435});
assert.equal(SHARDFILE_ADMISSION_LIMITS.sourceBytes, 2000000);
assert.equal(typeof assetOverdraw, 'function');
const sim = await HeadlessSimulation.create(source, new Map(), undefined, {deadline:'advisory'});
try {
  const first = await sim.step([{source:'input',commands:[{kind:'player',moveX:1,moveZ:0,yaw:0}]}]);
  const next = await sim.step();
  const fresh = await HeadlessSimulation.create(source, new Map(), first.snapshot, {deadline:'advisory'});
  try {assert.equal((await fresh.step()).snapshot, next.snapshot);} finally {await fresh.dispose();}
  const previous = sim.checkpoint;
  const commands = Array.from({length:source.serverBudget.commandsPerTick + 1}, () => ({kind:'script',actorId:'actor.player',value:0}));
  await assert.rejects(sim.step([{source:'input',commands}]), /Aggregate/);
  assert.equal(sim.checkpoint.snapshot, previous.snapshot);
  await sim.finish();
  await assert.rejects(sim.step(), /validation finished/);
  assert.equal(sim.checkpoint.snapshot, previous.snapshot);
  const proof = await validateSimulation(source, new Map());
  assert.equal(proof.ticks,60);assert.equal(proof.timing.samples,60);assert.ok(proof.lanes > 0 && proof.steps > 0);
  console.log(JSON.stringify({pass:true,worker:'installed JS',workspaceAliases:false,exactSnapshot:true,aggregateOverflow:true,terminalValidation:true,...proof}));
} finally {await sim.dispose();}
