import assert from 'node:assert/strict';
import {openProductSession} from './productSession.ts';
import {driftwoodQuestIntroTape} from '../../proof/driftwood-isle/verbTape.ts';
import {skyKeeperTape} from '../../proof/far-reach/verbTape.ts';
const slug=process.argv[2];
if(slug!=='driftwood-isle'&&slug!=='far-reach')throw new Error('Unknown native quest tape');
const {sim}=await openProductSession(slug);
try {
  const report=await sim.verbTape(slug==='driftwood-isle'?driftwoodQuestIntroTape():skyKeeperTape());
  const at=id=>{const row=report.observations.find(row=>row.id===id);assert.ok(row,`Missing actual observation ${id}`);return row;};
  if(slug==='driftwood-isle'){
    assert.equal(at('chest-out-of-reach').flags.includes('has:flint'),false);
    assert.equal(at('chest-out-of-reach').quests.find(row=>row.id==='sealed-ring')?.started,false);
    assert.equal(at('talk-to-castaway').flags.includes('talked:castaway'),true);
    assert.equal(at('talk-to-castaway').quests.find(row=>row.id==='sealed-ring')?.started,true);
    assert.equal(at('open-chest').flags.includes('open:castaway-chest'),true);
    assert.equal(at('open-chest').flags.includes('has:flint'),true);
    assert.equal(at('walk-to-lookout').flags.includes('lit:beacon'),false);
    assert.equal(at('light-beacon').flags.includes('lit:beacon'),true);
    assert.equal(at('walk-to-lookout-shard').flags.includes('shard:lookout'),false);
    assert.equal(at('take-lookout-shard').flags.includes('shard:lookout'),true);
    assert.equal(at('take-lookout-shard-again').effects.length,0,'repeated use cannot mint another reward');
    assert.equal(at('take-lookout-shard').quests.find(row=>row.id==='sealed-ring')?.complete,false,'the other two real shards are still required');
    assert.deepEqual(at('open-chest-again').flags,at('open-chest').flags,'a second use cannot repeat the chest transition');
  }else{
    assert.equal(at('keeper-out-of-reach').flags.includes('far.notes'),false);
    assert.equal(at('talk-to-keeper').flags.includes('far.notes'),true);
    assert.equal(at('talk-to-keeper').quests.find(row=>row.id==='far.quest')?.currentId,'roost');
    assert.equal(at('talk-to-keeper-again').quests.find(row=>row.id==='far.quest')?.currentId,'roost');
    for(const flag of ['far.roost','far.vanes','far.bridge'])assert.equal(at('unearned-winch').flags.includes(flag),false);
  }
  assert.equal(sim.quarantined,false);
  console.log(JSON.stringify({slug,ticks:report.ticks,observations:report.observations.map(({id,tick,position,flags,quests})=>({id,tick,position,flags,quests}))}));
}finally{await sim.dispose();}
