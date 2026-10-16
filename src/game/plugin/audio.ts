import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { GROUND_SURFACES, type AudioSurfaceMap, type GroundSurface, type AudioSurfacePorts } from '@wildshard/engine/audio/surface';
import type { DeclaredAmbiencePorts } from '@wildshard/engine/audio/declaredAmbience';
import { swordEvents } from '../weapons/Sword';
import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import type { DeclaredGameplayPorts } from '@wildshard/engine/audio/declaredGameplay';
import { installDeclaredAudio } from '@wildshard/engine/audio/declared';
import { CatalogueScore } from '@wildshard/engine/audio/SetScore';
import type { Music } from '@wildshard/engine/audio/Music';
import { createAudioObserver, requireAudioProfile, type AudioObservationPorts } from '@wildshard/engine/audio/audioProfiles';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueMap, CombatCueOpts, CombatCues } from '@wildshard/engine/combat/cues';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Scope } from '@wildshard/engine/app/scope';
import type { AudioData } from '@wildshard/format/audio';
import type { GameServices, ShardContext } from './context';
import { installEnteredRuntimeObserver, installEnteredRuntimeService, retainsRuntimeServices } from '../shard/retainedHooks';
import { installSilentScore } from '../systems/audio/silentScore';
import { crossbowFire, dryFire, boltImpact, reload } from "../systems/audio/crossbowSounds";
import { rifleFire, rifleReload } from "../systems/audio/firearmSounds";
import { swordSwing, swordHeavy, swordHit } from "../systems/audio/meleeSounds";

/** Resolve this resident's admitted emitted rows; only legacy-only entries use the original declaration. */
export function runtimeAudio(context: { readonly game: Pick<GameServices, 'declaredAudio'> }, legacy: AudioData): AudioData {
  return context.game.declaredAudio ?? legacy;
}

/**
 * A runtime's declared audio in play (SF29; Signal Dunes and Sky Reach): its admitted rows (`runtimeAudio`), the silent
 * score when they say so, and the shard's combat cues routed by them, on each entry of a retained home (else the level's
 * scope). Absent play (headless), nothing.
 */
export function installRuntimeAudio(context: ShardContext, legacy: AudioData,
  cues: (audio: Audio, combat: CombatCues, scope: Scope, routing: AudioData['routing']) => void = installDeclaredCombatCues): void {
  const play = context.game.runtime?.play;
  if (!play) return;
  const rows = runtimeAudio(context, legacy);
  installEnteredRuntimeService(context, scope => { if (rows.score === 'silent') installSilentScore(play.music, scope); cues(play.audio, play.cues, scope, rows.routing); });
}

/** Sound operations supplied by the owning mixer; the router allocates no audio resources. */
export interface CombatAudio {
  rifleFire: () => void; crossbowFire: () => void; swordSwing: () => void; swordHeavy: () => void;
  swordHit: (surface: 'wood' | 'ground' | 'flesh', pan: number, gain: number) => void;
  boltImpact: (surface: 'wood' | 'ground' | 'flesh', pan: number, gain: number) => void;
  dryFire: () => void; rifleReload: () => void; reload: () => void; weaponSwap: () => void;
}
const surfaceOf = (opts: CombatCueOpts): 'wood' | 'ground' | 'flesh' => opts.surface === 'wood' || opts.surface === 'flesh' ? opts.surface : 'ground';
/** Shared synth fallback retains the methods which own today's literal sound tap ids. */
export function sharedCombatCues(audio: CombatAudio, meleeSilent: boolean): CombatCueMap {
  return (id, opts) => {
    switch (id) {
      case 'cue.firearm.fire': case 'cue.lever.fire': audio.rifleFire(); return true;
      case 'cue.crossbow.fire': case 'cue.longbow.loose': case 'cue.bow.loose': audio.crossbowFire(); return true;
      case 'cue.sabre.swing': case 'cue.spear.thrust': case 'cue.sword.swing': case 'cue.jian.swing':
        if (!meleeSilent) audio.swordSwing(); return true;
      case 'cue.sword.heavy': case 'cue.jian.heavy': if (!meleeSilent) audio.swordHeavy(); return true;
      case 'cue.sword.hit': case 'cue.sabre.hit': case 'cue.jian.hit':
        if (!meleeSilent) audio.swordHit(surfaceOf(opts), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.javelin.hit': case 'cue.arrow.hit': case 'cue.projectile.hit': audio.boltImpact(surfaceOf(opts), opts.pan ?? 0, opts.gain ?? 1); return true;
      case 'cue.firearm.reload': case 'cue.lever.reload': audio.rifleReload(); return true;
      case 'cue.reload': audio.reload(); return true;
      case 'cue.dry': case 'cue.lever.dry': audio.dryFire(); return true;
      case 'cue.swap': audio.weaponSwap(); return true;
      default: return false;
    }
  };
}


/** Only the oscillator blocks and sample/cue ports that an equipment recipe reads. */
export interface WeaponSynth {
  readonly ready: boolean; readonly ctx: Pick<AudioContext, 'currentTime'>;
  shot: Audio['shot']; cue: Audio['cue'];
  burst: (opts: Parameters<Audio['burst']>[0]) => void;
  tone: (opts: Parameters<Audio['tone']>[0]) => void;
}

/** The platform's default equipment voices; samples and synth blocks come from the level's mixer. */
export function sharedWeaponVoices(audio: Audio): {
  crossbowFire: () => void; dryFire: () => void; reload: () => void; rifleFire: () => void; rifleReload: () => void;
  swordSwing: () => void; swordHeavy: () => void; weaponSwap: () => void;
  boltImpact: (kind: 'wood' | 'ground' | 'flesh', pan?: number, gain?: number) => void;
  swordHit: (kind?: 'wood' | 'ground' | 'flesh', pan?: number, gain?: number) => void;
} {
  return {
    crossbowFire: () => { crossbowFire(audio); }, dryFire: () => { dryFire(audio); }, reload: () => { reload(audio); },
    rifleFire: () => { rifleFire(audio); }, rifleReload: () => { rifleReload(audio); },
    swordSwing: () => { swordSwing(audio); }, swordHeavy: () => { swordHeavy(audio); },
    boltImpact: (kind, pan, gain) => { boltImpact(audio, kind, pan, gain); },
    swordHit: (kind, pan, gain) => { swordHit(audio, kind, pan, gain); },
    weaponSwap: () => { audio.weaponSwap(); },
  };
}

/** Catalogue voices for declared audio; reuse the existing sampled/synth recipes and impact surface routing. */
export function declaredWeaponVoices(audio: Audio): ReadonlyMap<string, (opts: CombatCueOpts) => void> {
  const voices = sharedWeaponVoices(audio);
  return new Map<string, (opts: CombatCueOpts) => void>([
    ['sword.swing', () => { voices.swordSwing(); }], ['sword.heavy', () => { voices.swordHeavy(); }],
    ['sword.hit', (opts) => { voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); }],
    ['weapon.reload', () => { voices.reload(); }], ['weapon.swap', () => { voices.weaponSwap(); }],
    ['kit.swordSwing', () => { voices.swordSwing(); }], ['kit.swordHeavy', () => { voices.swordHeavy(); }],
    ['kit.swordHit', (opts) => { voices.swordHit('flesh', opts.pan, opts.gain); }],
    ['kit.reload', () => { voices.reload(); }], ['kit.weaponSwap', () => { voices.weaponSwap(); }],
  ]);
}

/** Bind admitted combat routing directly to shared native voices, without a shard dispatcher. */
export function installDeclaredCombatCues(audio: Audio, cues: CombatCues, scope: Scope, routing: AudioData['routing']): void {
  const voices = new Map([...declaredWeaponVoices(audio)].map(([id, voice]) => [id, (opts: CombatCueOpts): undefined => { voice(opts); }]));
  cues.use(createCueRouter(routing, { voices }), scope);
}

/** Bind emitted observation rows without installing or touching a mixer during construction. */
export function audioObserverSystems(rows:NonNullable<AudioData['observations']>,ports:AudioObservationPorts):{
  systems:Parameters<ShardContext['system']>[0][];value:(system:string,id:string)=>number
} {
  if(rows.length>16)throw new Error('Audio observation system capacity');
  const controllers=new Map(rows.map(row=>[row.id,createAudioObserver(row,ports)]));
  return {systems:rows.map(row=>({id:row.id,phase:'update',after:row.after,before:row.before,run:(dt,t)=>{controllers.get(row.id)?.run(dt,t);}})),
    value:(system,id)=>{const controller=controllers.get(system);if(controller===undefined)throw new Error('Missing audio observation system');return controller.state(id);}};
}

/** Install declared score banks with the resident catalogue's entered-scope policy and existing reload pin. */
export function installRuntimeScore(context:ShardContext,audio:Audio,music:Music):void {
  const rows=runtimeAudio(context,context.product.shardfile.audio),profile=rows.music;
  if(profile?.lifecycle===undefined)throw new Error('Missing declared score lifecycle');
  const retained=profile.lifecycle.persistent&&retainsRuntimeServices(context),pin=profile.lifecycle.debugPin;
  let registerDebug=true;
  const install=(scope:Scope):void=>{
    const score=installDeclaredAudio(rows,{audio,music,scope,beforeBind:()=>{
      if(registerDebug&&pin!==undefined)context.debugRow({...pin,group:'audio',initial:CatalogueScore.pin(profile)??pin.initial,reload:true,change:()=>undefined});
    }},'score');
    registerDebug=false;
    if(retained){const bank=music.residentBank();if(bank!==undefined)score.useStyleBank(bank);}
  };
  if(profile.lifecycle.persistent)installEnteredRuntimeService(context,install);else install(context.scope);
}

/** Native scene loans to the declared installer, never shard TS event adapters. */
export type RuntimeGameplayAudioPorts=Omit<DeclaredGameplayPorts,'ambience'>&{
  audio:Audio;ambience?:DeclaredGameplayPorts['ambience'];bank?:DeclaredSoundBank;
  listener?:object;objects?:Record<string,unknown>;
};
function audioOwner(owners:Readonly<Record<string,object|null|undefined>>,ref:{owner:string;path:readonly string[]}):unknown {
  if(!Object.hasOwn(owners,ref.owner))throw new Error(`Missing audio owner: ${ref.owner}`);
  let value:unknown=owners[ref.owner];for(const key of ref.path){if(value===null||value===undefined)return undefined;if(typeof value!=='object')throw new Error('Invalid audio owner path');value=Reflect.get(value,key);}return value;
}
function audioFloor(value:unknown):value is NonNullable<AudioSurfacePorts['floors'][string][number]> {return typeof value==='object'&&value!==null&&'floorHeightAt' in value&&typeof value.floorHeightAt==='function';}
function audioDusk(value:unknown):value is NonNullable<DeclaredGameplayPorts['dusk']>{return typeof value==='object'&&value!==null&&'setDusk' in value&&typeof value.setDusk==='function';}
function audioPoints(value:unknown):value is readonly {x:number;z:number}[]{return Array.isArray(value)&&value.length<=2048&&value.every((point:unknown)=>typeof point==='object'&&point!==null&&'x' in point&&typeof point.x==='number'&&'z' in point&&typeof point.z==='number');}
/** Install admitted gameplay bindings using native owner loans, with no shard callbacks. */
export async function installRuntimeGameplayAudio(context:ShardContext,borrowed:RuntimeGameplayAudioPorts):Promise<void> {
  const rows=runtimeAudio(context,context.product.shardfile.audio),policy=rows.gameplay;
  if(policy===undefined)throw new Error('Missing audio gameplay bindings');
  const environment=policy.environment;
  let ambience=borrowed.ambience,bank=borrowed.bank,dusk=borrowed.dusk,emitters=borrowed.emitters;
  let surfaces:AudioSurfaceMap<GroundSurface>|undefined,releaseEnvironment:(()=>void)|undefined;
  if(environment!==undefined){
    const {trailDistance}=await import('@wildshard/engine/world/Heightfield');
    const sea=context.product.shardfile.water.find(body=>body.kind==='sea');if(sea?.kind!=='sea')throw new Error('Missing audio sea');
    const read=(ref:{owner:string;path:readonly string[]}):unknown=>audioOwner(borrowed.owners,ref);
    const nativeDusk=read(environment.dusk);if(nativeDusk!==undefined&&nativeDusk!==null&&!audioDusk(nativeDusk))throw new Error('Invalid audio dusk owner');
    dusk=nativeDusk??null;
    const point=read(environment.emitter.point);let hum:ReturnType<Audio['loopEmitter']>|null=null;
    if(point!==undefined&&point!==null){
      if(typeof point!=='object'||!('x' in point)||!('z' in point)||typeof point.x!=='number'||typeof point.z!=='number')throw new Error('Invalid audio emitter point');
      hum=borrowed.audio.loopEmitter(requireAudioProfile(rows.emitters?.[environment.emitter.profile],'audio emitter'),requireAudioProfile(rows.loopGraphs,'audio graphs'),{position:{x:point.x,y:terrainHeight(point.x,point.z)+environment.emitter.height,z:point.z},duck:gain=>{borrowed.music.duck(gain);}});
    }
    emitters={[environment.emitter.id]:hum};
    bank=installDeclaredAudio(context.product.shardfile.audio,{audio:borrowed.audio,scope:context.scope},'voices');
    const floors=Object.fromEntries(Object.entries(environment.floors).map(([id,refs])=>[id,refs.flatMap(ref=>{const raw=read(ref),values:readonly unknown[]=Array.isArray(raw)?raw:[raw];if(values.length>512||!values.every(value=>value===null||value===undefined||audioFloor(value)))throw new Error('Invalid audio floor owners');return values;})]));
    surfaces=borrowed.audio.surfaceMap(requireAudioProfile(rows.surfaces,'audio surfaces'),GROUND_SURFACES,{sea:sea.level,heightAt:terrainHeight,values:{trail:trailDistance},floors});
    const objects=Object.fromEntries(Object.entries(environment.objects).map(([id,ref])=>{const object=read(ref);if(object!==null&&object!==undefined&&typeof object!=='object')throw new Error('Invalid ambience object');return [id,object];}));
    const near:DeclaredAmbiencePorts['near']=Object.fromEntries(Object.entries(environment.near).map(([id,ref])=>{const points=read(ref);if(points!==undefined&&!audioPoints(points))throw new Error('Invalid ambience points');return [id,points];}));
    const active=installDeclaredAudio(rows,{audio:borrowed.audio,sea:sea.level,objects,near,owners:borrowed.owners},'ambience');ambience=active;
    context.answer('player.stepSurface',request=>({...request,surface:surfaces?.surfaceAt(request.x,request.z,request.y)??request.surface}));
    releaseEnvironment=()=>{hum?.dispose();active.dispose();};
  }
  if(ambience===undefined)throw new Error('Missing gameplay ambience');
  const ports={...borrowed,ambience,...(dusk===undefined?{}:{dusk}),...(emitters===undefined?{}:{emitters})};
  const controller=installDeclaredAudio(rows,ports,'gameplay'),retained=policy.entered&&retainsRuntimeServices(context);
  const events=policy.cues;let restoreEvents:(()=>void)|undefined;
  if(events!==undefined){
    const listener=ports.listener;if(bank===undefined||listener===undefined)throw new Error('Missing gameplay cue owners');
    const cue=createCueRouter(rows.routing.filter(row=>row.bus==='audio'),{voices:new Map(),bindings:rows.voiceBindings,owners:new Map<string,object>([['sfx',bank],['playback',bank.playback],['listener',listener]])});
    ports.audio.installCues(cue,context.scope);
    const previous={onSwing:swordEvents.onSwing,onStrike:swordEvents.onStrike,onClang:swordEvents.onClang},melee=events.melee;
    swordEvents.onSwing=(speed,heavy,dir)=>{cue(melee.fire,{speed,heavy,dir});};
    swordEvents.onStrike=(kind,point,strength,killed)=>{cue(melee.hitPrefix+(melee.materials[kind]??melee.fallback),{point,strength});if(killed)cue(melee.death,{kind,point,gain:melee.deathGain});};
    swordEvents.onClang=(point,strength,kind)=>{cue(melee.clangPrefix+kind,{point,strength});};
    const water=ports.audio.setUnderwater.bind(ports.audio);
    if(events.underwater)ports.audio.setUnderwater=on=>{water(on);ports.ambience.setUnderwater(on);};
    restoreEvents=()=>{swordEvents.onSwing=previous.onSwing;swordEvents.onStrike=previous.onStrike;swordEvents.onClang=previous.onClang;if(events.underwater)ports.audio.setUnderwater=water;};
  }
  const diagnostic=policy.diagnostic;
  if(!policy.entered){for(const system of controller.systems)context.system(system);controller.enter(context.scope,false);}
  else {
    if(retained&&diagnostic!==undefined)installEnteredRuntimeObserver(context,diagnostic.name,controller.diagnostic);
    const install=(scope:Scope):void=>{for(const system of controller.systems)context.app.addSystem(system,scope);controller.enter(scope,retained);if(!retained&&diagnostic!==undefined&&typeof window!=='undefined')scope.expose(window,diagnostic.name,controller.diagnostic);};
    if(retained)installEnteredRuntimeService(context,install);else {const scope=context.app.levelScope;if(scope===null)throw new Error('Missing gameplay level scope');install(scope);}
  }
  let handles:Record<string,unknown>|undefined;
  const objects=ports.objects;
  if(environment!==undefined){
    if(objects===undefined)throw new Error('Missing gameplay object registry');
    const owners={...ports.owners,bank,surfaces,ambience,emitters};
    handles=Object.fromEntries(Object.entries(environment.publish.values).map(([id,ref])=>[id,audioOwner(owners,ref)]));
    Object.assign(objects,handles);context.debug.expose(environment.publish.id,handles);
  }
  context.scope.onDispose(()=>{restoreEvents?.();releaseEnvironment?.();if(objects!==undefined)for(const [key,value] of Object.entries(handles??{}))if(objects[key]===value)delete objects[key];});
}

/** Select an admitted entry stage; wind and score keep their native scopes and restoration laws. */
export function installRuntimeAudioEntry(context:ShardContext,stage:string,ports:{audio:Audio;music?:Music}):void {
  const authored=context.product.section('audio/audio').audio,entry=authored.entry?.[stage];
  if(entry===undefined)throw new Error('Missing declared audio entry stage');
  if(entry.score){if(ports.music===undefined)throw new Error('Missing audio entry music');installRuntimeScore(context,ports.audio,ports.music);}
  if(entry.wind){
    const samples=authored.samples;if(samples===undefined)throw new Error('Missing audio entry samples');
    const wind=runtimeAudio(context,authored).ambience;if(wind===null)throw new Error('Missing audio entry wind');
    if(!retainsRuntimeServices(context)){ports.audio.windBed(wind,context.scope);return;}
    installEnteredRuntimeService(context,scope=>{
      const previous=ports.audio.bedId;ports.audio.windBed(wind,scope);ports.audio.setAmbient(samples.bed);
      scope.onDispose(()=>{if(ports.audio.bedId===samples.bed)ports.audio.setAmbient(previous);});
    });
  }
}
