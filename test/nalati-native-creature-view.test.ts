import {expect,test} from 'vitest';
import {BufferGeometry,Mesh,MeshBasicMaterial,Object3D,PerspectiveCamera,Vector3} from 'three';
import {createSimHost} from '../src/engine/sim';
import {loadRapier} from '../src/engine/physics/rapier';
import {fixtureBytes} from '@wildshard/engine/test/nativeBytes';
import {viewProgram} from '../src/engine/script/viewProgram';
import {speciesViewSlots} from '../src/game/population/speciesViewSlots';
import {compileScriptV2} from '../src/sdk/bake/compileScriptV2';
import {nalatiCreatureViews} from '../src/shards/nalati-grasslands/generators/creatureViews';
import source from '../src/shards/nalati-grasslands/behaviour/creatureViews.as?raw';
import {NalatiCreatureView} from './fixtures/nalati-creature-view-native';
import {SIM_LEVEL} from './fixtures/sim-level/level';

const ground=(x:number,z:number):number=>.1*x+.05*z+3;
test('native creature heights retain page guest arithmetic and a complete restored death suffix',async()=>{
  const rows=nalatiCreatureViews(),bytes=await compileScriptV2(source,{lane:'view',ioBytes:rows.budget.ioBytes});
  const rapier=await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm',import.meta.url))));
  const first=SIM_LEVEL.entities[0];if(first===undefined)throw new Error('Missing original fixture body');
  const make=()=>createSimHost({...SIM_LEVEL,quests:[],entities:[{...first,spec:{...first.spec,kind:'balbal'},id:'view:1'}]},{rapier});
  const pageHost=make(),record=make(),restored=make();
  const pageBody=pageHost.entities.get('view:1'),body=record.entities.get('view:1'),copy=restored.entities.get('view:1');
  if(pageBody===undefined||body===undefined||copy===undefined)throw new Error('Missing native view bodies');
  const mesh=new Object3D(),cracks=new Mesh(new BufferGeometry(),new MeshBasicMaterial());cracks.name='balbal-cracks';mesh.add(cracks);
  const actor={entityId:pageBody.entityId,kind:pageBody.kind,mesh,position:pageBody.position,
    get yaw(){return pageBody.yaw;},get alive(){return pageBody.alive;},mem:pageBody.mem,get attackPhase(){return pageBody.attackPhase;},
    get scale(){return pageBody.scale;},get seed(){return pageBody.seed;},get yOffset(){return pageBody.yOffset;},set yOffset(value:number){pageBody.yOffset=value;}};
  const slots=new Map(rows.pools.map(row=>[row.group,speciesViewSlots(()=>[actor],row.group.slice(8),row.count,ground)]));
  const page=viewProgram(bytes,rows,{scope:pageHost.scope,player:{position:new Vector3(),velocity:new Vector3(),yaw:0},camera:new PerspectiveCamera(),
    displayHz:15,values:()=>null,floor:()=>null,slots:group=>slots.get(group)??null,
    object:()=>{throw new Error('No named creature object');},look:()=>{throw new Error('No creature look channel');}});
  if(page===null)throw new Error('Original page view did not bind');
  const native=new NalatiCreatureView(bytes,rows,record.scope,()=>[body],ground);
  const next=new NalatiCreatureView(bytes,rows,restored.scope,()=>[copy],ground);
  try{
    for(let tick=0;tick<180;tick++){
      for(const a of tick<90?[pageBody,body]:[pageBody,body,copy]){
        a.mem['field']=1;a.mem['rise']=Math.min(1,tick/50);
        if(tick===45)a.applyDamage(10000,new Vector3(),new Vector3());
      }
      page.frame(1/30,(tick+1)/30);native.frame(1/30);
      expect(Object.is(body.yOffset,pageBody.yOffset)).toBe(true);
      if(tick===89){
        copy.restore(body.snapshot());const before=copy.snapshot();next.restore(native.snapshot());expect(copy.snapshot()).toStrictEqual(before);
      }else if(tick>89){
        next.frame(1/30);expect(Object.is(copy.yOffset,body.yOffset)).toBe(true);
        expect(next.snapshot()).toStrictEqual(native.snapshot());
      }
    }
    const before=next.snapshot();expect(()=>next.restore({...before,source:'foreign'})).toThrow('Foreign');expect(next.snapshot()).toStrictEqual(before);
    expect(()=>next.restore({...before,slots:[['missing'],[]]})).toThrow('Foreign');expect(next.snapshot()).toStrictEqual(before);
    record.scope.dispose();expect(()=>native.frame(1/30)).toThrow('retired');
  }finally{pageHost.scope.dispose();record.scope.dispose();restored.scope.dispose();cracks.geometry.dispose();cracks.material.dispose();}
},30_000);
