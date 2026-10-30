// @vitest-environment node
import {expect,test} from 'vitest';
import {openProductSession} from './fixtures/headless/productSession';
import {decodeSimSnapshot} from '../src/engine/sim/snapshot';
import type {HeadlessTickCommit} from '../src/sdk/tickProtocol';

function doorState(commit:HeadlessTickCommit){
  const saved=decodeSimSnapshot(commit.snapshot),row=saved.adapters.find(adapter=>adapter.id==='pine.doors');
  if(row===undefined)throw new Error('Missing real door continuation');return row.state;
}

test('the actual moving cabin leaf reconnects its existing physics handles and continues after restore',async()=>{
  const original=await openProductSession('pine-hollow','pine-verbs');
  let restored:Awaited<ReturnType<typeof openProductSession>>|undefined;
  try{
    await original.sim.walkLeg({ticks:6000,once:true,points:[[0,-190],[-8,-150],[-30,-95],[-12,-52],[-1,-40],[-5.71,-31.7],[-7.99,-35.02],[-9.56,-34.66]].map(([x,z])=>{
      if(x===undefined||z===undefined)throw new Error('Missing actual porch waypoint');return {x,z};
    })});
    const opened=await original.sim.step([{source:'door.use',commands:[{kind:'script',actorId:'pine.door',value:0}]}]);
    restored=await openProductSession('pine-hollow','pine-verbs',opened.snapshot);
    const [continued,replayed]=await Promise.all([original.sim.step(),restored.sim.step()]);
    expect(continued.tick).toBe(opened.tick+1);expect(replayed.tick).toBe(continued.tick);
    expect(doorState(replayed)).toEqual(doorState(continued));
    expect(doorState(replayed)).not.toEqual(doorState(opened));
    expect(original.sim.quarantined).toBe(false);expect(restored.sim.quarantined).toBe(false);
  }finally{await original.sim.dispose();await restored?.sim.dispose();}
},30_000);
