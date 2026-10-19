import { expect, test } from 'vitest';
import { installChannelPrograms } from '../../../../src/game/plugin/channelPrograms';
import { bloomthroatIguanaNativeClips } from '../../../../src/shards/driftwood-isle/generators/bloomthroatIguanaNativeClips';

test('actual numeric DAG maintains pose continuity at exact bite phase boundaries',()=>{
 const clips=bloomthroatIguanaNativeClips(),frame={deathT:-1,flinch:0,t:0,speed:0},strike={phase:0,elapsed:0,index:0};
 const joints=new Map(clips.programs.flatMap(p=>p.numeric?.outputs.map(o=>[o.target,{rotation:{x:0,y:0,z:0},position:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}}] as const)??[]));
 const owners=new Map<string,unknown>(joints);owners.set('frame',frame);owners.set('strike',strike);
 const evaluator=installChannelPrograms(clips.programs,clips.group,owners);
 const pose=(phase:number,elapsed:number)=>{strike.phase=phase;strike.elapsed=elapsed;strike.index=phase===0?0:1;evaluator.evaluate({time:0,delta:1/60,values:{}});return Array.from(joints.values()).flatMap(j=>[j.rotation.x,j.rotation.y,j.rotation.z,j.position.x,j.position.y,j.position.z]);};
 const compare=(a:number[],b:number[])=>expect(Math.max(...a.map((x,i)=>Math.abs(x-(b[i]??Infinity))))).toBeLessThan(1e-12);
 compare(pose(1,.75),pose(2,0));compare(pose(2,.16),pose(3,0));compare(pose(3,.9),pose(0,0));
 frame.deathT=1;const dead=pose(0,0);frame.t=100;frame.speed=1;frame.flinch=1;compare(dead,pose(2,.08));
});
