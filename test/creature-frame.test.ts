import { expect,test } from 'vitest';
import { Bone,Vector3 } from 'three';
import { numericChannelPrograms } from '../src/sdk/clientChannels';
import { CreatureFrame } from '../src/game/population/creatureFrame';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';

test('orchard pose retains declared visual fields and keeps channel scratch private',()=>{
  setTerrainHeight(()=>2);
  const observe=numericChannelPrograms('orchard.observe','orchard.observe',[{target:'mem',path:['stretch'],expr:(b,read)=>b.binary('mul',read('frame',['speed']),b.constant(.5))}]);
  const pose=numericChannelPrograms('orchard.pose','creature.pose',[{target:'joint.body',path:['scale','y'],expr:(_b,read)=>read('frame',['mem','stretch'])}]);
  const frame=new CreatureFrame({defaults:{},smooth:[{input:'ground',output:'smoothed',rate:2,initial:null}],
    floor:{field:'smoothed',lift:'hover',death:'fallTime',delay:.5,rate:2},look:[1,1,1],group:'orchard.observe',observations:observe,pose:{group:'creature.pose',programs:pose}});
  const position=new Vector3(3,4,5),mem:Record<string,number>={ground:4,hover:1};
  const c:AnimalRigContext={bones:{body:new Bone()},dims:{bodyY:1,bodyHalfLen:1,bodyRadius:.4,headRadius:.3,legLen:1,feet:[],halfWidth:.4},
    dt:.1,t:1,seed:.4,scale:1,speed:3,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,
    lookTarget:new Vector3(),lookWeight:0,position,yaw:0,mem,animal:{position,mem,yOffset:0}};
  frame.animate(c);expect(c.bones['body']?.scale.y).toBe(1.5);expect(mem['smoothed']).toBe(4);expect(c.animal.yOffset).toBe(3);expect(mem['stretch']).toBeUndefined();
  mem['ground']=9;frame.animate(c);expect(mem['smoothed']).toBe(5);expect(c.animal.yOffset).toBe(4);
  c.alive=false;c.dt=1;frame.animate(c);expect(mem['fallTime']).toBe(1);expect(c.animal.yOffset).toBe(7);
});
