// oxlint-disable-next-line import/no-nodejs-modules -- Use the shipped native motor in the walk parity proof.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {loadRapier} from '../src/engine/physics/rapier';
import {createShardfileSim} from '../src/game/plugin/simulation';
import {emptyShardfile} from '../src/sdk/author';
import {walkVelocity,walkingSpeed} from '../src/engine/player/walk';
import {runHeadlessJourney} from '../src/sdk/headlessJourney';

test('the shared page acceleration preserves its arithmetic through turns and stopping',()=>{
  let original=0,shared=0;
  for(const target of [4.3,-4.3,0,2.2])for(let tick=0;tick<60;tick++){
    const acceleration=tick<30?14:3,dt=1/60;
    original+=(target-original)*Math.min(1,acceleration*dt);
    shared=walkVelocity(shared,target,acceleration,dt);
    expect(Object.is(shared,original)).toBe(true);
  }
});

test('the opted-in native walk accelerates while ordinary motion keeps its own speed',async()=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const sim=createShardfileSim(emptyShardfile({slug:'walk-motion',name:'Walk motion',author:'Test',revision:1,seed:1}),new Map(),{rapier});
  try{
    const {host}=sim;
    for(let tick=0;tick<120;tick++)host.step();
    const before=host.player.position.clone(),clientMotion={x:0,z:0};
    const release=host.usePlayerDriver({walking:{speed:walkingSpeed(false,false,0,1,1),crouching:false,clientMotion},input:()=>false,step:()=>undefined});
    host.step({moveX:1,moveZ:0,yaw:-Math.PI/2});
    expect(clientMotion.x).toBe(walkVelocity(0,4.3,14,1/60));
    const accelerated=host.player.position.x-before.x;
    expect(accelerated).toBeGreaterThan(0);expect(accelerated).toBeLessThan(4.3/60);
    release();
    const prior=host.player.position.x;
    host.step({moveX:1,moveZ:0,yaw:-Math.PI/2});
    expect(host.player.position.x-prior).toBeGreaterThan(accelerated);
  }finally{sim.dispose();}
});

test('a failed route releases its temporary page motion before a later driver binds',async()=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const sim=createShardfileSim(emptyShardfile({slug:'walk-release',name:'Walk release',author:'Test',revision:1,seed:1}),new Map(),{rapier});
  try{
    expect(()=>runHeadlessJourney(sim.host,()=>{throw new Error('Native step refused');},{ticks:1,points:[{x:0,z:0},{x:10,z:0}]})).toThrow('Native step refused');
    const release=sim.host.usePlayerDriver({input:()=>false,step:()=>undefined});
    release();
  }finally{sim.dispose();}
});
