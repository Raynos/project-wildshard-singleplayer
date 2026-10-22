// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {Group,PerspectiveCamera} from 'three';
import {Scope} from '../src/engine/app/scope';
import {Audio} from '../src/engine/audio/Audio';
import {Music} from '../src/engine/audio/Music';
import {parseAudioData} from '../src/format/audio';
import {SceneHandles} from '../src/game/shardfile/sceneHandles';
import {LivingBuildings} from '../src/game/shardfile/livingBuildings';
import {publishEntryOwner,lendEntryOwner} from '../src/game/shardfile/entryOwners';
import {bindResidentWorldScope} from '../src/game/shardfile/hybridPresentation';
import {enterClientAudioScene} from '../src/game/audio/sceneDirector';
import * as gameplay from '../src/game/plugin/audio';
import type {ShardContext} from '../src/game/plugin/context';
import {driftwoodGameplayAudioEnvironment} from '../src/shards/driftwood-isle/generators/gameplayAudioEnvironment';
import source from '../src/shards/driftwood-isle/data/audioSource.json' with {type:'json'};
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json' with {type:'json'};
import island from '../src/shards/driftwood-isle/data/islandFacts.generated.json' with {type:'json'};
import wreck from '../src/shards/driftwood-isle/data/wreckBake.json' with {type:'json'};
import cove from '../src/shards/driftwood-isle/data/coveComposition.json' with {type:'json'};
import {legacyDouble} from './fake/FakeGame';

it('emits the completed world facts in their original tier order, with the four floor gaps',()=>{
 const rows=driftwoodGameplayAudioEnvironment();
 const data=parseAudioData({...source.audio,gameplay:{...source.audio.gameplay,entryEnvironment:rows}});
 expect(data.gameplay?.environment).toBeUndefined();expect(data.gameplay?.entryEnvironment).toEqual(rows);
 expect(rows.floors).toEqual({decks:[null,null,'boat',null,null,'bridge','wreck'],stone:['shrine']});
 expect(rows.bounds).toEqual({holdBox:wreck.holdBounds,caveBox:cove.audioBounds});
 expect(rows.bounds['holdBox']).not.toBe(wreck.holdBounds);expect(rows.bounds['caveBox']).not.toBe(cove.audioBounds);
 for(const tier of ['phone','desktop'] as const){
  const expected=[...foliage.tiers[tier].palms.specs,...island.extraPalms].map(({x,z})=>({x,z}));
  expect(rows.near['palms']?.[tier]).toEqual(expected);
  expect(rows.near['palms']?.[tier][0]).not.toBe(foliage.tiers[tier].palms.specs[0]);
 }
 expect(rows.emitter).toEqual({id:'hum',profile:'shrine',point:'shrine',height:2.5});
 expect(rows.publish).toEqual({id:'driftwood.audio',hum:'shrineHum',bank:'islandSfx',surfaces:'surfaces',ambience:'ambience'});
});
function fixture(tier:'phone'|'desktop',missing?:'bridge'|'buildings'){
 const construction=new Scope('audio-source'),scope=construction.child('audio-entered');bindResidentWorldScope(scope,construction);
 const rows=driftwoodGameplayAudioEnvironment(),data=parseAudioData({...source.audio,gameplay:{...source.audio.gameplay,entryEnvironment:rows}});
 const shrine=new Group(),life=new LivingBuildings(new SceneHandles(),{wheel:0,door:{seconds:1,angle:1},fire:[0,1],lamp:[0,1],glass:[0,1],flicker:{depth:0,waves:[]},swing:{z:[],x:[0,0]}});
 const audio=new Audio(),music=new Music(audio),camera=new PerspectiveCamera(),objects={};
 const floors={boat:()=>3,bridge:()=>4,wreck:()=>6,shrine:()=>5};
 for(const [id,floor] of Object.entries(floors))if(id!==missing){publishEntryOwner(construction,'floor',id,floor);lendEntryOwner(scope,construction,'floor',id);}
 publishEntryOwner(construction,'object','shrine',shrine);lendEntryOwner(scope,construction,'object','shrine');
 if(missing!=='buildings'){publishEntryOwner(construction,'buildings','shrine',life);lendEntryOwner(scope,construction,'buildings','shrine');}
 type Runtime=NonNullable<ShardContext['game']['runtime']>;
 const runtime=legacyDouble<Runtime>({world:legacyDouble<NonNullable<Runtime['world']>>({game:legacyDouble<NonNullable<Runtime['world']>['game']>({tier,camera}),sky:legacyDouble<NonNullable<Runtime['world']>['sky']>({}),player:legacyDouble<NonNullable<Runtime['world']>['player']>({})}),play:legacyDouble<NonNullable<Runtime['play']>>({audio,music}),objects});
 const ctx=legacyDouble<ShardContext>({scope,product:legacyDouble<ShardContext['product']>({shardfile:legacyDouble<ShardContext['product']['shardfile']>({audio:data})}),game:legacyDouble<ShardContext['game']>({runtime,declaredAudio:data})});
 return {construction,scope,ctx,rows,data,shrine,life,floors};
}
it.each(['phone','desktop'] as const)('preflights original %s loans into the existing play/audio phase exactly once',async tier=>{
 const f=fixture(tier),entry=vi.spyOn(gameplay,'installRuntimeAudioEntry').mockImplementation(()=>undefined),install=vi.spyOn(gameplay,'installRuntimeGameplayAudio').mockResolvedValue(undefined);
 try{
  await enterClientAudioScene(f.ctx);
  expect(entry).toHaveBeenCalledOnce();expect(entry.mock.calls[0]?.[1]).toBe('play');expect(install).toHaveBeenCalledOnce();
  const native=install.mock.calls[0]?.[2];if(native===undefined)throw new Error('Missing concrete gameplay environment');
  expect(native.scope).toBe(f.construction);expect(native.dusk).toBe(f.life);expect(native.emitter.point).toBe(f.shrine);
  expect(native.floors['decks']).toEqual([null,null,f.floors.boat,null,null,f.floors.bridge,f.floors.wreck]);
  expect(native.floors['stone']).toEqual([f.floors.shrine]);
  expect(native.near['palms']).toBe(f.data.gameplay?.entryEnvironment?.near['palms']?.[tier]);
  expect(native.bounds['holdBox']).toBe(f.data.gameplay?.entryEnvironment?.bounds['holdBox']);
  expect(entry.mock.invocationCallOrder[0]).toBeLessThan(install.mock.invocationCallOrder[0]??0);
 }finally{entry.mockRestore();install.mockRestore();f.construction.dispose();}
});
it.each(['bridge','buildings','retired'] as const)('refuses missing or %s construction before any audio effect',async missing=>{
 const f=fixture('phone',missing==='retired'?undefined:missing),entry=vi.spyOn(gameplay,'installRuntimeAudioEntry').mockImplementation(()=>undefined),install=vi.spyOn(gameplay,'installRuntimeGameplayAudio').mockResolvedValue(undefined);
 try{
  if(missing==='retired')f.construction.dispose();
  await expect(enterClientAudioScene(f.ctx)).rejects.toThrow(missing==='retired'?'has ended':'Missing live entry owner');
  expect(entry).not.toHaveBeenCalled();expect(install).not.toHaveBeenCalled();
 }finally{entry.mockRestore();install.mockRestore();f.construction.dispose();}
});

it('refuses a declared finite environment without its concrete native loans',async()=>{
 const f=fixture('phone'),audio=new Audio(),hum=vi.spyOn(audio,'loopEmitter');
 try{
  await expect(gameplay.installRuntimeGameplayAudio(f.ctx,{audio,music:new Music(audio),camera:new PerspectiveCamera(),owners:{}})).rejects.toThrow('Missing concrete gameplay audio loans');
  expect(hum).not.toHaveBeenCalled();
 }finally{hum.mockRestore();f.construction.dispose();}
});
