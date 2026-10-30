// oxlint-disable-next-line import/no-nodejs-modules -- The real native world uses the shipped physics module.
import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {loadRapier} from '../src/engine/physics/rapier';
import {rideable} from '../src/engine/physics/CharacterMotor';
import {groups} from '../src/engine/physics/groups';
import {createShardfileSim} from '../src/game/plugin/simulation';
import {emptyShardfile} from '../src/sdk/author';

test.each([true,false])('native moving-body ride and jump (carry=%s)',async(carry)=>{
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const source=emptyShardfile({slug:'carry-proof',name:'Carry proof',author:'Test',revision:1,seed:12});
  const sim=createShardfileSim(source,new Map(),{rapier}),host=sim.host,{world,R}=host.physics;
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setGravityScale(0).setTranslation(0,1,0));
  world.createCollider(R.ColliderDesc.cuboid(3,.5,3).setMass(1000).setCollisionGroups(groups('WORLD')),body);rideable(body);
  const move={moveX:0,moveZ:0,yaw:0};
  try{
    host.player.position.set(0,2,0);host.player.motor.resetAt(host.player.position);
    for(let tick=0;tick<60;tick++)host.step(move);
    expect(host.playerFall.grounded).toBe(true);
    const start=host.player.position.clone(),bodyStart=body.translation();
    if(!carry)vi.spyOn(host.player.motor,'carry').mockReturnValue(false);
    for(let tick=1;tick<=60;tick++){
      body.setLinvel({x:0,y:0,z:0},true);body.setTranslation({x:tick*.02,y:1+tick*.005,z:0},true);host.step(move);
    }
    if(carry){
      // Dynamic bodies respond to the rider's mass; compare actual body motion,
      // not the requested trajectory before that native contact was resolved.
      const end=body.translation();
      expect(Math.abs((host.player.position.x-end.x)-(start.x-bodyStart.x))).toBeLessThan(host.player.motor.opts.radius);
      expect(Math.abs((host.player.position.y-end.y)-(start.y-bodyStart.y))).toBeLessThan(host.player.motor.opts.snap);
      expect(host.playerFall.grounded).toBe(true);
      const jumped=host.player.position.y;host.step({...move,jump:true});
      expect(host.player.position.y).toBeGreaterThan(jumped);expect(host.playerFall.grounded).toBe(false);
    }else{
      expect(Math.abs(host.player.position.x-start.x)).toBeLessThan(.1);
      expect(Math.abs(host.player.position.y-start.y)).toBeLessThan(.1);
    }
  }finally{vi.restoreAllMocks();sim.dispose();}
});
