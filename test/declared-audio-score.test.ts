// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {Audio} from '@wildshard/engine/audio/Audio';
import {Music} from '@wildshard/engine/audio/Music';
import {CatalogueScore,type ScoreSource} from '@wildshard/engine/audio/SetScore';
import {installDeclaredAudio} from '@wildshard/engine/audio/declared';
import {Scope} from '@wildshard/engine/app/scope';
import {App} from '@wildshard/engine/app/app';
import {jsonSlot} from '@wildshard/engine/saves/slots';
import {createLevelInstallation} from '@wildshard/engine/level/installation';
import type {DebugRowSpec} from '@wildshard/engine/level/context';
import {parseAudioData,AudioDataSchema} from '@wildshard/format/audio';
import {formatJsonSchema} from '@wildshard/sdk/formatJsonSchema';
import {shardContext} from '../src/game/plugin/context';
import {installRuntimeScore} from '../src/game/plugin/audio';
import {RetainedRuntimeHooks} from '../src/game/shard/retainedHooks';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '@wildshard/sdk/author';
import {MANIFEST as TEMPLATE} from '../src/shards/_template/discovery.generated';
import pineSource from '../src/shards/pine-hollow/data/audioSource.json' with {type:'json'};
import islandSource from '../src/shards/driftwood-isle/data/audioSource.json' with {type:'json'};

const pine=parseAudioData(pineSource.audio),island=parseAudioData(islandSource.audio);
function mixer(){
 const audio=new Audio(),music=new Music(audio),order:string[]=[];
 let active:ScoreSource|undefined;
 vi.spyOn(music,'refreshScore').mockImplementation(()=>{/* No WebAudio graph in this scope proof. */});
 vi.spyOn(music,'setScore').mockImplementation((_id,source)=>{
  active=source;order.push('bind');return()=>{if(active===source){active=undefined;order.push('unbind');}};
 });
 vi.spyOn(audio,'onLevelBank').mockImplementation((_listener,scope)=>{order.push('bank');scope.onDispose(()=>{order.push('bank.off');});});
 return {audio,music,order,active:()=>active};
}
it('keeps device-over-legacy score pins, invalid-value defaults and phase/sting rows',()=>{
 expect(()=>formatJsonSchema(AudioDataSchema)).not.toThrow();
 const profile=pine.music;if(profile===undefined)throw new Error('Missing score');
 const device=jsonSlot('debug.plugin.pine-hollow.pineScore','device'),settings=jsonSlot('settings','global');
 const original=device.read(),legacy=settings.read();
 try{
  device.write(null);settings.write({pineScore:'boss-2'});expect(CatalogueScore.pin(profile)).toBe('boss-2');
  const {music}=mixer(),score=CatalogueScore.get(music,profile);
  expect(score.sceneName).toBe('boss');expect(score.phase).toBe(2);
  device.write('night');expect(CatalogueScore.pin(profile)).toBe('night');
  device.write('invalid');expect(CatalogueScore.pin(profile)).toBe('auto');
  expect(CatalogueScore.pin(island.music??profile)).toBeUndefined();
  expect(()=>parseAudioData({...pine,music:{...profile,lifecycle:{...profile.lifecycle,debugPin:{...profile.lifecycle?.debugPin,initial:'missing'}}}})).toThrow();
 }finally{device.write(original);settings.write(legacy);}
});
it('keeps the pinned sting delayed on the entered scope and cancels it on leave',()=>{
 const device=jsonSlot('debug.plugin.pine-hollow.pineScore','device'),original=device.read();
 vi.useFakeTimers();
 const scope=new Scope('score.sting');
 try{
  device.write('dawn');const {audio,music}=mixer(),sting=vi.spyOn(music,'sting').mockImplementation(()=>{/* Playback remains native. */});
  const score=installDeclaredAudio(pine,{audio,music,scope},'score');
  score.onDeck('title');vi.advanceTimersByTime(2100);expect(sting).not.toHaveBeenCalled();
  score.onDeck('pine');vi.advanceTimersByTime(1999);expect(sting).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);expect(sting).toHaveBeenCalledExactlyOnceWith('dawn');
  const again=mixer(),cancel=new Scope('score.cancel'),pending=installDeclaredAudio(pine,{audio:again.audio,music:again.music,scope:cancel},'score');
  const cancelled=vi.spyOn(again.music,'sting').mockImplementation(()=>{/* Cancelled native playback. */});
  pending.onDeck('pine');cancel.dispose();vi.advanceTimersByTime(2100);expect(cancelled).not.toHaveBeenCalled();
 }finally{scope.dispose();device.write(original);vi.useRealTimers();}
});
it('installs the native bank in the same order and keeps persistent state across entered scopes',()=>{
 const {audio,music,order,active}=mixer(),first=new Scope('score.first');
 const score=installDeclaredAudio(pine,{audio,music,scope:first,beforeBind:()=>{order.push('before');}},'score');
 expect(order).toEqual(['bind','before','bind','bank']);expect(active()).toBe(score);
 score.setScene('boss');score.setBossPhase(3);
 const dispose=vi.spyOn(score,'dispose');first.dispose();expect(active()).toBeUndefined();expect(dispose).not.toHaveBeenCalled();
 const second=new Scope('score.second');
 const entered=installDeclaredAudio(pine,{audio,music,scope:second},'score');
 expect(entered).toBe(score);expect(entered.sceneName).toBe('boss');expect(entered.phase).toBe(3);
 second.dispose();expect(order.filter(event=>event==='bank.off')).toHaveLength(2);
 expect(()=>installDeclaredAudio(pine,{audio,music,scope:second},'score')).toThrow('disposed');
 const ordinary=new Scope('score.ordinary'),fresh=installDeclaredAudio(island,{audio,music,scope:ordinary},'score');
 const free=vi.spyOn(fresh,'dispose');ordinary.dispose();expect(free).toHaveBeenCalledOnce();
 const next=new Scope('score.next');expect(installDeclaredAudio(island,{audio,music,scope:next},'score')).not.toBe(fresh);next.dispose();
});
it('defers a retained score until entry and registers its existing reload choice only once',()=>{
 const {audio,music,active}=mixer(),scope=new Scope('score.home'),app=new App(),debug=vi.fn<(row:DebugRowSpec)=>()=>void>(()=>()=>{/* Resident choice cleanup. */});
 const level=createLevelInstallation(app,scope,{debugRow:debug},()=>({set:()=>{/* No loading UI. */},detail:()=>{/* No loading UI. */}}));
 const source=emptyShardfile({slug:'template',name:'Score',author:'Wildshard',revision:1,seed:1});
 const product=createShardProduct({slug:'template',revision:1,shardfile:source,sections:new Map(),files:new Map(),read:()=>Promise.reject(new Error('Unexpected file'))});
 const context=shardContext(level.context,TEMPLATE,{shard:TEMPLATE,rows:new Map(),declaredAudio:pine,bag:{tab:()=>()=>{/* No inventory. */},fragment:()=>()=>{/* No inventory. */}}},product);
 const retained=new RetainedRuntimeHooks(context,{deferActivation:true});
 try{
  installRuntimeScore(retained.context,audio,music);expect(active()).toBeUndefined();expect(debug).not.toHaveBeenCalled();
  retained.activate();const score=active();expect(score).toBeInstanceOf(CatalogueScore);expect(debug).toHaveBeenCalledOnce();
  expect(debug.mock.lastCall?.[0]).toMatchObject({id:'pineScore',initial:'auto',reload:true,choices:pine.music?.lifecycle?.debugPin?.choices});
  retained.deactivate();expect(active()).toBeUndefined();retained.activate();expect(active()).toBe(score);expect(debug).toHaveBeenCalledOnce();
  const ordinary=mixer(),bank=vi.spyOn(ordinary.music,'residentBank');
  const other=new RetainedRuntimeHooks({...context,game:{...context.game,declaredAudio:island}},{deferActivation:true});
  installRuntimeScore(other.context,ordinary.audio,ordinary.music);
  expect(ordinary.active()).toBeInstanceOf(CatalogueScore);expect(bank).toHaveBeenCalledOnce();
  expect(debug).toHaveBeenCalledOnce();
 }finally{scope.dispose();}
});
