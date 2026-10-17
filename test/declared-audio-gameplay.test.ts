// @vitest-environment happy-dom
import { swordEvents } from '@wildshard/game/weapons/Sword';
import { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import { DeclaredAmbience } from '@wildshard/engine/audio/declaredAmbience';
import { LoopEmitter } from '@wildshard/engine/audio/ambience';
import { AudioSurfaceMap } from '@wildshard/engine/audio/surface';
import { setTerrainHeight } from '@wildshard/engine/world/terrainHeight';
import { App } from '@wildshard/engine/app/app';
import { createLevelInstallation } from '@wildshard/engine/level/installation';
import { shardContext } from '../src/game/plugin/context';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installRuntimeAudioEntry,installRuntimeGameplayAudio } from '../src/game/plugin/audio';
import { emptyShardfile } from '@wildshard/sdk/author';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import { expect,it,vi } from 'vitest';
import { PerspectiveCamera,Vector3 } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { Audio } from '@wildshard/engine/audio/Audio';
import { Music } from '@wildshard/engine/audio/Music';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import { installDeclaredAudio } from '@wildshard/engine/audio/declared';
import type { DeclaredGameplayPorts, DoorMotionEvents } from '@wildshard/engine/audio/declaredGameplay';
import { createAudioObserver,requireAudioProfile,type AudioObservationEntity } from '@wildshard/engine/audio/audioProfiles';
import { parseAudioData } from '@wildshard/format/audio';
import pineSource from '../src/shards/pine-hollow/data/audioSource.json' with {type:'json'};
import islandSource from '../src/shards/driftwood-isle/data/audioSource.json' with {type:'json'};

const pine=parseAudioData(pineSource.audio),island=parseAudioData(islandSource.audio);
it('hears native door data only during its entered audio scope',()=>{
  class Feed extends EventTarget implements DoorMotionEvents {
    current:DoorMotionEvents['current']=null;
    move(opening:boolean):void{this.current={position:{x:3,y:4,z:5},opening};this.dispatchEvent(new Event('door'));}
  }
  const native=fixture(),changes=new Feed(),scope=new Scope('building-audio');
  const controller=installDeclaredAudio(pine,{...native.ports,doorChanges:changes},'gameplay');
  controller.enter(scope,true);expect(native.trace).not.toContainEqual(['subscribe']);
  changes.move(true);changes.move(false);
  const sounds=requireAudioProfile(pine.gameplay?.doors,'doors');
  expect(native.trace).toContainEqual(['shot',sounds.open,{x:3,y:4,z:5}]);
  expect(native.trace).toContainEqual(['shot',sounds.close,{x:3,y:4,z:5}]);
  scope.dispose();const count=native.trace.length;changes.move(true);expect(native.trace).toHaveLength(count);
});
function fixture(){
  const trace:unknown[]=[];
  class Mixer extends Audio {override shadeAmbient(level:number,cutoff:number):void{trace.push(['shade',level,cutoff]);}}
  class Score extends Music {override combat(value:number):void{trace.push(['combat',value]);}}
  const audio=new Mixer(),music=new Score(audio),camera=new PerspectiveCamera();let night=0;
  const ambience:DeclaredGameplayPorts['ambience']={
    get night(){return night;},set night(value){night=value;trace.push(['night',value]);},declaredSpots:[],
    sfx:{shot:(family,opts)=>{trace.push(['shot',family,opts?.at]);return true;}},
    setUnderwater:on=>{trace.push(['underwater',on]);},
    frame:(dt,view)=>{trace.push(['frame',dt,view===camera]);},setActive:on=>{trace.push(['active',on]);}
  };
  const sky={dayNight:{night:0,dusk:0}},elites:{focus:{state:string}|null}={focus:null};
  const deer:AudioObservationEntity&{state:string}={kind:'deer',state:'idle',alive:true,position:{x:1,y:2,z:3}};
  let door:Parameters<NonNullable<DeclaredGameplayPorts['doors']>['onDoor']>[0]|undefined;
  const ports:DeclaredGameplayPorts={audio,music,camera,ambience,owners:{sky,elites,animals:{animals:[deer]}},dusk:{setDusk:value=>{trace.push(['dusk',value]);}},emitters:{hum:{update:view=>{trace.push(['hum',view===camera]);}}},
    doors:{onDoor:listener=>{door=listener;trace.push(['subscribe']);return ()=>{door=undefined;trace.push(['unsubscribe']);};}}};
  return {ports,audio,music,trace,sky,elites,deer,door:(opening:boolean)=>{door?.({position:deer.position},opening);}};
}
it('replays native dusk/hum/ambience order against the original adapters without a clock copy',()=>{
  const old=fixture(),next=fixture();
  const originals=(island.observations??[]).map(row=>createAudioObserver(row,{inputs:new Map([['clock',()=>old.sky.dayNight]]),
    writers:new Map([['shrine.dusk',(v:number)=>old.ports.dusk?.setDusk(v)],['ambience.night',(v:number)=>{old.ports.ambience.night=v;}]]),
    commands:new Map([['hum',()=>old.ports.emitters?.['hum']?.update(old.ports.camera)],['ambience',(dt:number)=>old.ports.ambience.frame(dt,old.ports.camera)]])}));
  const controller=installDeclaredAudio(island,next.ports,'gameplay');
  for(const night of [0,.3,.6,1,.2]){
    old.sky.dayNight.night=next.sky.dayNight.night=night;old.sky.dayNight.dusk=next.sky.dayNight.dusk=night*.7;
    originals.forEach(observer=>observer.run(.1,night));controller.systems.forEach(system=>system.run(.1,night));
    expect(next.trace).toEqual(old.trace);
  }
});
it('preserves score hysteresis, engagement and deer transitions, point identity and entered teardown',()=>{
  const old=fixture(),next=fixture(),profile=requireAudioProfile(pine.music,'music');
  const score=CatalogueScore.get(old.ports.music,profile,undefined,undefined,false),row=structuredClone(requireAudioProfile(pine.observations?.[0],'observer'));
  const engaged=row.inputs.find(input=>input.id==='engaged');if(engaged===undefined)throw new Error('engaged');engaged.path=[];engaged.op='truth';delete engaged.value;
  const original:ReturnType<typeof createAudioObserver>=createAudioObserver(row,{inputs:new Map<string,()=>unknown>([['clock',()=>old.sky.dayNight],['pinned',()=>false],['score',()=>score],['engaged',()=>old.elites.focus?.state==='engaged'],['listener',()=>old.ports.camera.position]]),
    writers:new Map([['ambience.night',(v:number)=>{old.ports.ambience.night=v;}]]),entities:{animals:()=>[old.deer]},
    commands:new Map([['clock.change',()=>{/* separate log contract */}],['elite.change',()=>{/* separate log contract */}],['score.scene',()=>{score.setScene(original.state('night')!==0?'night':'day');}],['combat',()=>old.ports.music.combat(.8)],['deer.snort',(_dt:number,_t:number,event:{entity?:AudioObservationEntity})=>{if(event.entity===undefined)throw new Error('actor');old.ports.ambience.sfx.shot('deer_snort',{at:event.entity.position});}]])});
  const controller=installDeclaredAudio(pine,next.ports,'gameplay');
  let t=0;
  for(const night of [0,.56,.4,.34,1,0]){
    t+=1.1;old.sky.dayNight.night=next.sky.dayNight.night=night;old.elites.focus=next.elites.focus=t>2?{state:'engaged'}:null;
    old.deer.state=next.deer.state=t>2?'alert':'idle';original.run(.21,t);controller.systems[0]?.run(.21,t);
    expect(controller.value('audio','night')).toBe(original.state('night'));
    expect(CatalogueScore.get(next.ports.music,profile,undefined,undefined,false).sceneName).toBe(score.sceneName);
    expect(next.trace).toEqual(old.trace);
  }
  const scope=new Scope('entered.audio');controller.enter(scope,true);next.door(true);next.door(false);scope.dispose();next.door(true);
  expect(next.trace.slice(-7)).toEqual([['active',true],['subscribe'],['shot','doorOpen',next.deer.position],['shot','doorClose',next.deer.position],['unsubscribe'],['active',false],['shade',1,20000]]);
  const shot=next.trace.find((value):value is unknown[]=>Array.isArray(value)&&value[0]==='shot');expect(shot?.[2]).toBe(next.deer.position);
});
it('refuses unknown owners and unbounded authored gameplay rows before subscribing',()=>{
  const f=fixture();
  expect(()=>installDeclaredAudio({...island,gameplay:{...requireAudioProfile(island.gameplay,'bindings'),inputs:{clock:{owner:'missing',path:[]}}}},f.ports,'gameplay')).toThrow('owner');
  expect(f.trace).toEqual([]);
  expect(()=>parseAudioData({...island,gameplay:{...island.gameplay,inputs:{clock:{owner:'sky',path:['a','b','c','d','e']}}}})).toThrow();
});

it('defers entered wind, restores only its own bed and keeps ordinary registration unchanged',()=>{
  const calls:unknown[]=[];
  class Mixer extends Audio {
    bedState='previous';override get bedId():string{return this.bedState;}
    override setAmbient(on:Parameters<Audio['setAmbient']>[0]):void {calls.push(['bed',on]);if(typeof on==='string')this.bedState=on;}
    override windBed(rows:Parameters<Audio['windBed']>[0],scope?:Scope):ReturnType<Audio['windBed']>{calls.push(['wind',rows.bed,scope?.name]);return super.windBed(rows,scope);}
  }
  const scope=new Scope('home'),app=new App(),audio=new Mixer();
  const level=createLevelInstallation(app,scope,{},()=>({set:()=>{/* no UI */},detail:()=>{/* no UI */}}));
  const source=emptyShardfile({slug:'template',name:'Entry',author:'Wildshard',revision:1,seed:1});
  const product=createShardProduct({slug:'template',revision:1,shardfile:source,sections:new Map([['audio/audio',{audio:pine}]]),files:new Map(),read:()=>Promise.reject(new Error('Unexpected bytes'))});
  const context=shardContext(level.context,TEMPLATE,{shard:TEMPLATE,rows:new Map(),declaredAudio:pine,bag:{tab:()=>()=>{/* no inventory */},fragment:()=>()=>{/* no inventory */}}},product);
  const retained=new RetainedRuntimeHooks(context,{deferActivation:true});
  try {
    installRuntimeAudioEntry(retained.context,'kit',{audio});expect(calls).toEqual([]);
    retained.activate();expect(calls.map((value):unknown=>{if(!Array.isArray(value))return value;const list:readonly unknown[]=value;return list[0];})).toEqual(['wind','bed']);
    expect(audio.bedId).toBe(pine.samples?.bed);retained.deactivate();expect(audio.bedId).toBe('previous');
    retained.activate();audio.setAmbient('another-home');retained.deactivate();expect(audio.bedId).toBe('another-home');
    calls.length=0;installRuntimeAudioEntry(context,'kit',{audio});expect(calls).toEqual([['wind',pine.ambience?.bed,'home']]);
    expect(()=>installRuntimeAudioEntry(context,'missing',{audio})).toThrow('entry stage');
  }finally {scope.dispose();}
});

it('binds native melee/water events, original spatial owners and teardown without shard adapters',async()=>{
  const f=fixture(),scope=new Scope('audio.world'),app=new App(),objects:Record<string,unknown>={};
  const level=createLevelInstallation(app,scope,{},()=>({set:()=>{/* no UI */},detail:()=>{/* no UI */}}));
  const source=emptyShardfile({slug:'template',name:'Gameplay',author:'Wildshard',revision:1,seed:1});source.audio=island;source.water=[{id:'sea',kind:'sea',level:0,waves:true}];
  const product=createShardProduct({slug:'template',revision:1,shardfile:source,sections:new Map([['audio/audio',{audio:island}]]),files:new Map(),read:()=>Promise.reject(new Error('Unexpected bytes'))});
  const context=shardContext(level.context,TEMPLATE,{shard:TEMPLATE,rows:new Map(),declaredAudio:island,bag:{tab:()=>()=>{/* no inventory */},fragment:()=>()=>{/* no inventory */}}},product);
  const world={pier:{floorHeightAt:()=>3},jetties:[],boat:null,hut:null,lookout:null,bridge:null,wreck:null,shrine:{group:{position:{x:-98,y:0,z:108}},floorHeightAt:()=>5,setDusk:(n:number)=>{f.trace.push(['dusk',n]);}},palmSpecs:[{x:1,z:2}]};
  const nativePlayback=f.audio.voices.playback.bind(f.audio.voices);
  vi.spyOn(f.audio.voices,'playback').mockImplementation((...args)=>{const playback=nativePlayback(...args);vi.spyOn(playback,'play').mockReturnValue(true);return playback;});
  const saved={...swordEvents},water=vi.spyOn(f.audio,'setUnderwater').mockImplementation(on=>{f.trace.push(['native.water',on]);});
  await import('@wildshard/engine/world/Heightfield');setTerrainHeight(()=>0);
  try{
    await installRuntimeGameplayAudio(context,{audio:f.audio,music:f.music,camera:f.ports.camera,listener:{position:{x:0,y:0,z:0},yaw:0},objects,owners:{world,sky:f.sky,cove:{fall:{foot:[127.5,18]},cave:{x:16,z:22,yaw:.7,depth:9}},wind:{uTime:{value:0},uWindStrength:{value:0}}}});
    const bank=objects['islandSfx'],ambience=objects['ambience'],hum=objects['shrineHum'],surface=objects['surfaces'];
    if(!(bank instanceof DeclaredSoundBank)||!(ambience instanceof DeclaredAmbience)||!(hum instanceof LoopEmitter)||!(surface instanceof AudioSurfaceMap))throw new Error('Missing native owner');
    expect(surface.surfaceAt(0,0,3)).toBe('planks');expect(surface.surfaceAt(0,0,5)).toBe('stone');
    const play=vi.spyOn(bank.playback,'play').mockReturnValue(true),under=vi.spyOn(ambience,'setUnderwater').mockImplementation(on=>{f.trace.push(['ambience.water',on]);});
    const point=new Vector3(1,2,3);
    swordEvents.onSwing?.(.8,true,-1);swordEvents.onStrike?.('crab',point,.7,true);swordEvents.onStrike?.('sailor',point,.4,false);swordEvents.onClang?.(point,.5,'stone');
    expect(play.mock.calls.map(call=>call[0])).toEqual(['heavy','impact','vocal','impact','impact']);
    expect(play.mock.calls[1]?.[1]).toEqual({material:'shell',strength:.7});expect(play.mock.calls[1]?.[2]?.at).toBe(point);
    expect(play.mock.calls[2]?.[1]?.['intensity']).toBe(1.3);expect(play.mock.calls[3]?.[1]).toEqual({material:'wood',strength:.4});
    f.trace.length=0;f.audio.setUnderwater(true);expect(f.trace).toEqual([['native.water',true],['ambience.water',true]]);expect(under).toHaveBeenCalledOnce();
    const disposeHum=vi.spyOn(hum,'dispose'),disposeAmbience=vi.spyOn(ambience,'dispose');
    scope.dispose();expect(disposeHum).toHaveBeenCalledOnce();expect(disposeAmbience).toHaveBeenCalledOnce();expect(objects).toEqual({});
    expect(swordEvents.onSwing).toBe(saved.onSwing);expect(swordEvents.onStrike).toBe(saved.onStrike);expect(swordEvents.onClang).toBe(saved.onClang);
    under.mockClear();f.audio.setUnderwater(false);expect(under).not.toHaveBeenCalled();expect(water).toHaveBeenLastCalledWith(false);
  }finally{scope.dispose();Object.assign(swordEvents,saved);setTerrainHeight(()=>0);}
});
