// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the native bounds owner with the shipped physics module.
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {loadRapier} from '../src/engine/physics/rapier';
import {floorBelow} from '../src/engine/physics/query';
import {createShardfileSim} from '../src/game/plugin/simulation';
import {emptyShardfile} from '../src/sdk/author';
import {installNativeWalkBounds,registerNativeWalkBounds} from './fixtures/headless/nativeBounds';

test('walk bounds activation is explicit and installs one owner per resident',async()=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const sim=createShardfileSim(emptyShardfile({slug:'bounds-proof',name:'Bounds proof',author:'Test',revision:1,seed:1}),new Map(),{rapier});
  try{
    const {host}=sim;
    registerNativeWalkBounds(host,{x0:-20,x1:20,z0:-20,z1:20,floor:-3});
    expect(host.hasStep('engine.world.bounds')).toBe(false);
    installNativeWalkBounds(host);
    expect(host.hasStep('engine.world.bounds')).toBe(true);
    expect(()=>installNativeWalkBounds(host)).not.toThrow();
  }finally{sim.dispose();}
});

test('ordered walk legs retain the actual grounded floor for fall recovery',async()=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const sim=createShardfileSim(emptyShardfile({slug:'safe-floor-proof',name:'Safe floor proof',author:'Test',revision:1,seed:1}),new Map(),{rapier});
  try{
    const {host}=sim;
    registerNativeWalkBounds(host,{x0:-20,x1:20,z0:-20,z1:20,floor:-3});installNativeWalkBounds(host);
    host.resetPlayerPose({x:4,y:1,z:3},0);
    for(let tick=0;tick<120;tick++)host.step();
    expect(host.playerFall.grounded).toBe(true);
    const stood=host.player.position.clone(),floor=floorBelow(host.physics,stood.x,stood.z,stood.y+0.6,1.2,host.player.motor.collider);
    expect(floor).toBeDefined();
    host.resetPlayerPose({x:4,y:-4,z:3},0);host.step();
    expect(host.player.position.x).toBe(stood.x);expect(host.player.position.z).toBe(stood.z);
    expect(host.player.position.y).toBe(floor);
  }finally{sim.dispose();}
});
