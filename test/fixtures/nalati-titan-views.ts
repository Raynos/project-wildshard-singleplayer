import {InstancedMesh,Vector3} from 'three';
import type {ArenaScriptData} from '../../src/format/arenaScriptRows';
import type {SimHost} from '../../src/engine/sim';
import {parsePrivateScene} from '../../src/format/clientChannels';
import {HeadlessCloudBody} from '../../src/game/boss/cloudRig';
import {ArenaWhirls} from '../../src/game/boss/arenaWhirls';
import type {ArenaTell,OpenArenaViews} from '../../src/game/boss/openArenaFight';

/** Only the drawing ports are silent. Heart matrices, pose feedback and every
 * whirlwind decision run their real owners. No drawn object is a target. */
export function titanNativeViews(host:SimHost,data:ArenaScriptData):OpenArenaViews {
  const tell=():ArenaTell=>({ring:()=>undefined,lane:()=>undefined,wedge:()=>undefined,hide:()=>undefined});
  const tells=new Map(Object.entries(data.geometry.arena.tells).map(([id,row])=>[id,Array.from({length:row.count},tell)]));
  const geometry=data.geometry,tier=geometry.phone;
  const scene=parsePrivateScene(geometry.arena.scene);
  const capacities=new Map<string,number>([['smoke',data.arenaFire.smokeCount[0]],['flames',data.arenaFire.flameCount]]);
  for(const node of scene.nodes)if(node.kind==='mesh'&&node.instances!==undefined)capacities.set(node.id,node.instances);
  const draws=new Map<string,InstancedMesh>();
  const instances=(id:string):InstancedMesh=>{
    const capacity=capacities.get(id);if(capacity===undefined)throw new Error(`Missing admitted arena draw ${id}`);
    let draw=draws.get(id);if(draw===undefined){draw=new InstancedMesh(undefined,undefined,capacity);draws.set(id,draw);}
    return draw;
  };
  host.scope.onDispose(()=>{for(const draw of draws.values()){draw.geometry.dispose();
    for(const material of Array.isArray(draw.material)?draw.material:[draw.material])material.dispose();}});
  return {
    body:pose=>new HeadlessCloudBody({...geometry.body,geometry:{...geometry.body.geometry,eyes:geometry.eyes},
      poses:geometry.poses,puffs:{...geometry.body.puffs,rows:tier.puffs}},pose,
      new Map([['place',{...data.arena.body,ground:host.groundHeightAt(data.arena.ground.x,data.arena.ground.z)}]])),
    arena:()=>({tell:(id,index=0)=>{const row=tells.get(id)?.[index];if(row===undefined)throw new Error(`Missing admitted arena tell ${id}`);return row;},
      tells:id=>{const rows=tells.get(id);if(rows===undefined)throw new Error(`Missing admitted arena tells ${id}`);return rows;},
      instances,mesh:()=>{throw new Error('Native arena has no drawn mesh borrower');},update:()=>undefined}),
    whirls:(_arena,wind,author,scope)=>{
      const law=new ArenaWhirls(data.whirls,wind,author,scope,(x,z)=>host.groundHeightAt(x,z));
      const hits:Vector3[]=[];
      return {arm:mask=>{law.arm(mask);},reset:()=>{law.reset();},bindView:()=>undefined,
        update:(dt,t,live,thinkDt,frame)=>{const points=law.update(dt,t,live,thinkDt,frame);
          points.forEach((point,index)=>{const at=hits[index]??new Vector3();at.set(point.x,point.y,point.z);hits[index]=at;});
          hits.length=points.length;return hits;},snapshot:()=>law.snapshot(),restore:saved=>{law.restore(saved);}};
    },
    whirlsPreflight:(rows,bindings)=>{ArenaWhirls.preflight(rows,bindings);},
    fire:()=>({update:()=>undefined,smoke:instances('smoke'),flames:instances('flames')}),
  };
}
