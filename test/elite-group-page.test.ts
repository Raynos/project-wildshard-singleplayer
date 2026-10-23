import {expect,test} from 'vitest';
import {Group,Scene,Vector3,SkinnedMesh,MeshLambertMaterial,Mesh,BufferGeometry,BufferAttribute,InterleavedBufferAttribute} from 'three';
import {Scope} from '../src/engine/app/scope';
import {setTerrainHeight} from '../src/engine/world/terrainHeight';
import type {Game} from '../src/engine/core/Game';
import type {Animal} from '../src/engine/entities/AnimalView';
import type {AnimalManager} from '../src/engine/entities/AnimalManager';
import type {StallionState} from '../src/engine/ai/herd';
import type {Player} from '../src/engine/player/Player';
import type {Elites} from '../src/game/Elite';
import {ExternalElitePage} from '../src/game/quest/elitePage';
import {ExternalElitePage as OriginalPage} from './fixtures/originalExternalElitePage';
import {ReturnProgram} from '../src/game/population/returnProgram';
import {legacyDouble} from './fake/FakeGame';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with {type:'json'};
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with {type:'json'};
import program from '../src/shards/nalati-grasslands/behaviour/eliteGroup.generated.json' with {type:'json'};

function fixture(original:boolean){
  setTerrainHeight(()=>0);
  const row=ecology.externalElites.find(candidate=>candidate.mode==='herd');if(row?.mode!=='herd')throw new Error('Missing original herd');
  const scope=new Scope('page.group'),scene=new Scene(),trace:unknown[][]=[];
  const animal=legacyDouble<Animal>({position:new Vector3(-0,2,3.123456789012345),hp:75,maxHp:100,alive:true,mesh:new SkinnedMesh(undefined,new MeshLambertMaterial())});
  const mount=legacyDouble<Animal>({position:new Vector3(2,0,-0),scale:1,mesh:new SkinnedMesh()});
  const group={stallion:animal as Animal|null,stallionState:'display' as StallionState,leadAway:(x:number,z:number)=>{trace.push(['lead',x,z]);}};
  const player=legacyDouble<Player>({position:new Vector3(12.1234567890123,0,-0)});
  const services={game:legacyDouble<Game>({scene,levelScope:scope}),animals:legacyDouble<AnimalManager>({}),player,
    elites:legacyDouble<Elites>({signature:id=>{trace.push(['signature',id]);},won:id=>{trace.push(['won',id]);}})};
  const controller=scope.run(()=>new (original?OriginalPage:ExternalElitePage)(row,services,ReturnProgram.page(original?admission:program,scope),new Group()));
  controller.observe(0,{available:true,kills:0,bonded:false,mount:null});controller.spawn();controller.drainEffects();controller.adopt(animal,group);
  const view=()=>scene.children.map(object=>{const geometry:unknown=object instanceof Mesh?object.geometry:null,attribute:unknown=geometry instanceof BufferGeometry?geometry.getAttribute('position'):null;return{visible:object.visible,position:object.position.toArray(),scale:object.scale.toArray(),quaternion:object.quaternion.toArray(),
    positions:attribute instanceof BufferAttribute||attribute instanceof InterleavedBufferAttribute?Array.from(attribute.array):[]};});
  return{scope,animal,mount,group,controller,trace,view};
}
test('page ABI2 projection preserves original geometry, f64 observation and ordered effects',()=>{
  const old=fixture(true),current=fixture(false);try{
    for(const [dt,state]of [[.04,'display'],[.06,'display'],[.031,'watch'],[.069,'charge'],[.1,'charge'],[.11,'beaten']] as const){
      for(const f of [old,current]){f.group.stallionState=state;f.controller.tick(dt,0,false,false);}
      expect(current.trace).toEqual(old.trace);expect(current.controller.barFrac()).toBe(old.controller.barFrac());expect(current.controller.broken()).toBe(old.controller.broken());expect(current.view()).toEqual(old.view());
    }
    for(const f of [old,current]){f.group.stallion=null;f.controller.observe(.1,{available:true,kills:0,bonded:true,mount:f.mount});f.controller.tick(.1,0,false,false);}
    expect(current.trace).toEqual(old.trace);expect(current.mount.scale).toBe(old.mount.scale);expect(current.mount.mesh.scale.toArray()).toEqual(old.mount.mesh.scale.toArray());expect(current.controller.drainEffects()).toEqual(old.controller.drainEffects());
  }finally{old.scope.dispose();current.scope.dispose();}
});
