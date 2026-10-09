import assert from 'node:assert/strict';
import { HeadlessSimulation } from '../../../src/sdk/headless.ts';
import { emptyShardfile } from '../../../src/sdk/author.ts';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot.ts';
const source = emptyShardfile({slug:'deferred-fixture',name:'Deferred fixture',author:'Test',revision:1,seed:435});
const options = {deadline:'advisory',trustedRuntime:{module:new URL('./deferredRuntime.ts',import.meta.url).href}};
for(const checkpoint of [6,18]) {
  const original = await HeadlessSimulation.create(source,new Map(),undefined,options);
  try {
    let result;
    for(let tick=0;tick<checkpoint;tick++) result=await original.step([]);
    assert.ok(result);
    const actors=decodeSimSnapshot(result.snapshot).entities.map(actor=>actor.id);
    assert.deepEqual(actors,checkpoint===6?['deferred:1']:[]);
    const restored=await HeadlessSimulation.create(source,new Map(),result.snapshot,options);
    try {
      for(let tick=checkpoint;tick<60;tick++) {
        const a=await original.step([]),b=await restored.step([]);
        assert.deepEqual(a,b,'the SDK install must receive the validated roster and keeper clock');
      }
    } finally {await restored.dispose();}
  } finally {await original.dispose();}
}
console.log(JSON.stringify({checkpoints:2,exact:true,respawns:true}));
