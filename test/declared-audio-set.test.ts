import {expect,it,vi,afterEach} from 'vitest';
import {createCatalogueAudio} from '@wildshard/engine/audio/levelAudio';
import {SetScore,type ScoreBank} from '@wildshard/engine/audio/SetScore';
import * as sets from '@wildshard/engine/audio/SetScore';
import * as stems from '@wildshard/engine/audio/Stems';
import * as cues from '@wildshard/engine/audio/Cues';
import * as preload from '@wildshard/engine/audio/preload';
import * as settings from '@wildshard/engine/ui/Settings';
import {parseAudioData} from '@wildshard/format/audio';
import {requireAudioProfile} from '@wildshard/engine/audio/audioProfiles';
import {createCueRouter} from '@wildshard/engine/audio/cueRouting';
import {NALATI_AUDIO} from '../src/shards/nalati-grasslands/generators/audio';
import {ND_AUDIO} from '../src/shards/nine-dragon-stack/data/audio';
import {createNalatiAudio} from '../src/shards/nalati-grasslands-legacy/runtime/audio/files';
import {createNdAudio,ndPick} from '../src/shards/nine-dragon-stack-legacy/runtime/audio/files';
import {steppePick,createSteppeScore} from '../src/shards/nalati-grasslands-legacy/runtime/audio/SteppeScore';
import type {CombatCueOpts} from '@wildshard/engine/combat/cues';

// The frozen shards are independent executable oracles. They are never modified.
afterEach(()=>{vi.restoreAllMocks();});
it.each([[NALATI_AUDIO,createNalatiAudio],[ND_AUDIO,createNdAudio]] as const)('retains score-set inventory, boot order and Synth gates %#',async(rows,original)=>{
 const selected=vi.spyOn(settings,'getSfxSet');
 const declared=await createCatalogueAudio(rows),legacy=await original();
 for(const sfx of ['synth',...settings.SFX_SETS] as const){
  selected.mockReturnValue(sfx);
  expect(declared.files()).toEqual(legacy.files());
  expect(declared.priorityFiles?.()).toEqual(legacy.priorityFiles?.());
  for(const style of ['synth',...settings.MUSIC_STYLES] as const)expect(declared.bootFiles(style)).toEqual(legacy.bootFiles(style));
 }
});
it.each([[NALATI_AUDIO,createNalatiAudio],[ND_AUDIO,createNdAudio]] as const)('retains title/score/cue/sample decode order, overlays and completion ticks %#',async(rows,original)=>{
 const selected=vi.spyOn(settings,'getSfxSet');
 let order:object[]=[];
 const buffer={} as AudioBuffer;
 vi.spyOn(stems,'decodeStyle').mockImplementation((style,slots,_read,_decode,onFile,set,stings)=>{
  order.push({kind:'title',style,slots,set:set??'base',stings:stings??['pickup','death','chunk','dawn']});onFile?.();return Promise.resolve({genre:style,set:set??'base',slots:new Map(),stings:new Map(),log:[]});
 });
 vi.spyOn(sets,'decodeScore').mockImplementation((set,slots,_read,_decode,stings,onFile)=>{
  order.push({kind:'score',set,slots,stings});onFile?.();return Promise.resolve({slots:new Map(),stings:new Map()});
 });
 vi.spyOn(cues,'decodeCueSet').mockImplementation((set,_read,_decode,onFile)=>{
  order.push({kind:'cues',set});onFile?.();return Promise.resolve({loops:new Map([['bed.river',{buffer,loopStart:0,loopEnd:1,gain:0.4}]]),shots:new Map([['arrow',[{buffer,offset:0,duration:1,gain:0.7}]]])});
 });
 vi.spyOn(preload,'decodeSfxSet').mockImplementation((set,bed,_read,onFile)=>{
  order.push({kind:'samples',set,bed});onFile?.();return Promise.resolve({set,credit:'fixture',loops:new Map([['river',{buffer,loopStart:0,loopEnd:1,gain:0.2}]]),shots:new Map()});
 });
 const declared=await createCatalogueAudio(rows),legacy=await original();
 for(const sfx of ['synth',...settings.SFX_SETS] as const)for(const style of ['synth','folk'] as const){
  selected.mockReturnValue(sfx);
  const run=async(profile:typeof declared)=>{
   order=[];let ticks=0;const bank=await profile.decode(style,()=>Promise.resolve(new ArrayBuffer(0)),()=>Promise.resolve(buffer),()=>{ticks++;});return {order:[...order],ticks,bank};
  };
  expect(await run(declared)).toEqual(await run(legacy));
 }
});
it('preserves every Nalati scene fallback and Nine Dragon combat/Well precedence',()=>{
 const read=():Promise<ArrayBuffer>=>Promise.reject(new Error('No decode during selection'));
 const decode=():Promise<AudioBuffer>=>Promise.reject(new Error('No decode during selection'));
 const onReady=():void=>{/* Native music refresh is borrowed. */};
 const nalati=SetScore.declared(requireAudioProfile(NALATI_AUDIO.music,'music'),{refreshScore:onReady},{read,decode});
 const original=createSteppeScore(read,decode,onReady);
 for(const zone of ['grass','sky','snow'] as const)for(const night of [false,true])for(const storm of [false,true])for(const boss of [null,'king'] as const){
  const scene={zone,night,storm,boss};Object.assign(nalati.scene,scene);Object.assign(original.scene,scene);
  expect(nalati.target()).toBe(steppePick(scene)[0]);expect(nalati.target()).toBe(original.target());
 }
 const dragon=SetScore.declared(requireAudioProfile(ND_AUDIO.music,'music'),{refreshScore:onReady},{read,decode});
 for(const well of [0,0.5,0.50001,1])for(const mode of ['calm','alert','combat'] as const){
  const state={mode,intensity:0,underwater:false};dragon.scene['well']=well;
  expect(dragon.target(state)).toBe(ndPick({well},state)[0]);
 }
 const bank:ScoreBank={slots:new Map(),stings:new Map()};
 expect(dragon.pending).toBe(true);dragon.useBank(bank);expect(dragon.pending).toBe(false);
 expect(nalati.pending).toBe(false);
 expect(()=>SetScore.declared({...requireAudioProfile(ND_AUDIO.music,'music'),source:null},{refreshScore:onReady},{read,decode})).toThrow();
 expect(()=>parseAudioData({...ND_AUDIO,music:{...ND_AUDIO.music,setPlayback:{scene:{},stateMode:true,waitForBank:'yes'}}})).toThrow();
});
it('routes Nalati voices with the original power, impact normalization and synchronous thrust port',()=>{
 const calls:object[]=[];
 const voices=Object.fromEntries(['bowTwang','bowDraw','bowFullDraw','bowLetDown','javelinThrow','sabreSwing','arrowImpact','javelinImpact','sabreHit'].map(method=>[method,(...args:unknown[])=>{calls.push({method,args});}]));
 const thrust={start:()=>{calls.push({method:'thrustPending',args:[]});}};
 const route=createCueRouter(NALATI_AUDIO.routing,{voices:new Map(),bindings:NALATI_AUDIO.voiceBindings,owners:new Map<string,object>([['voices',voices],['thrust',thrust]])});
 for(const [id,method] of [['cue.arrow.hit','arrowImpact'],['cue.javelin.hit','javelinImpact'],['cue.sabre.hit','sabreHit']])for(const surface of [undefined,'wood','flesh','ground','metal']){
  calls.length=0;const opts:CombatCueOpts=surface===undefined?{}:{surface,pan:0.2,gain:0.4};
  expect(route(id??'',opts)).toBe(true);expect(calls).toEqual([{method,args:[surface==='wood'||surface==='flesh'?surface:'ground',surface===undefined?0:0.2,surface===undefined?1:0.4]}]);
 }
 calls.length=0;expect(route('cue.bow.loose',{})).toBe(true);expect(calls).toEqual([]);
 expect(route('cue.bow.loose.power',{})).toBe(true);expect(calls).toEqual([{method:'bowTwang',args:[1]}]);
 calls.length=0;expect(route('cue.spear.thrust',{})).toBe(true);expect(calls).toEqual([{method:'thrustPending',args:[]}]);
 expect(route('unknown',{})).toBe(false);
});
