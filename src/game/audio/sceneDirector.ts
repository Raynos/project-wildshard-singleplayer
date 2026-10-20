import { runtimeAudio } from '../plugin/audio';
import type { ShardProduct } from '../shardfile/shardProduct';
import { Vector3 } from 'three';
import { parse } from 'valibot';
import { unzlibSync } from 'fflate';
import { AudioSceneSchema, type AudioScene } from '@wildshard/format/audioScene';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import type { AudioData } from '@wildshard/format/audio';
import type { Audio, HoofSurface, ImpactKind } from '@wildshard/engine/audio/Audio';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Player } from '@wildshard/engine/player/Player';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { SampledAmbience } from '@wildshard/engine/audio/AmbienceBeds';
import { SetScore } from '@wildshard/engine/audio/SetScore';
import { audioMixValue, requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import { panFromYaw, audioRandom } from '@wildshard/engine/audio/util';
import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import { CombatCues } from '@wildshard/engine/combat/cues';
import type { ShardContext } from '../plugin/context';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { AudioVoicePatches } from './voicePatches';

/** Native polyline observation; returns distance and the direction toward its closest point. */
export function audioPathProbe(points:readonly (readonly [number,number])[],x:number,z:number):{distance:number;x:number;z:number}{
 let distance=Infinity,px=0,pz=0;
 for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];if(a===undefined||b===undefined)continue;const vx=b[0]-a[0],vz=b[1]-a[1],l2=vx*vx+vz*vz,t=l2>0?Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/l2)):0,ax=a[0]+vx*t,az=a[1]+vz*t,d=Math.hypot(x-ax,z-az);if(d<distance){distance=d;px=ax;pz=az;}}
 return {distance,x:distance>0?(px-x)/distance:0,z:distance>0?(pz-z)/distance:0};
}
/** Client-only zone/cue director. Content supplies rows and numeric observations; all borrowed owners are native. */
export class AudioSceneDirector {
 readonly rows:AudioScene;
 readonly inputs:Record<string,number>;
 private readonly fields=new Map<string,(x:number,z:number)=>number>();
 private readonly cues=new CombatCues();
 private readonly point=new Vector3();
 private audio:Audio|null=null;
 voices:AudioVoicePatches|null=null;
 ambience:SampledAmbience|null=null;
 private score:ReturnType<typeof SetScore.declared>|undefined;
 private music:Music|undefined;
 private bedT=0;private chorusT:number;private thrustPending=false;
 constructor(private readonly data:AudioData,private readonly player:Player){
  this.rows=parse(AudioSceneSchema,data.scene);this.inputs={...this.rows.initial};this.chorusT=this.rows.chorus.initial;
  for(const [id,encoded]of Object.entries(this.rows.fields.channels)){const bytes=unzlibSync(Uint8Array.from(atob(encoded.join('')),c=>c.codePointAt(0)??0));if(bytes.byteLength!==this.rows.fields.res**2*4)throw new Error('Invalid audio field lattice');const heights=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);if(!heights.every(value=>Number.isFinite(value)))throw new Error('Invalid audio field sample');this.fields.set(id,bakedSamplers({res:this.rows.fields.res,size:this.rows.fields.size,heights,seed:0,landscapeHash:0,splat:new Uint8Array(0),undergrowth:null}).heightAt);}
 }
 /** Native scoped signal subscriptions; weapon ids/phases and creature events are declared rows. */
 listen(ctx:ShardContext):void{
  ctx.on('creature.signal',({name,x,z})=>{this.event(name,x,z);});
  ctx.on('weapon.charge',({id,phase,value})=>{for(const row of this.rows.charges){if(row.weapon!==id||row.phase!==phase)continue;if(row.cancelDeferred)this.thrustPending=false;this.cues.cue((value===1&&row.full!==undefined?row.full:row.cue) as `cue.${string}`,{strength:value??1});}});
 }
 /** Re-enter with a fresh lifetime, restoring native hoof, bed and animal-sound owners on exit. */
 bind(a:Audio,music:Music|undefined,animals:AnimalManager|undefined,scope:Scope):void{
  this.audio=a;this.music=music;
  const previousHoof=a.hoofSurfaceAt,previousBed=a.bedId,previousAnimal=animals&&Object.getOwnPropertyDescriptor(animals,'onSound');
  const hoof=(x:number,z:number):HoofSurface=>this.surfaceAt(x,z);a.hoofSurfaceAt=hoof;
  const voices=new AudioVoicePatches(a,this.data,requireAudioProfile(this.data.patches,'voice patches'),scope);voices.install();this.voices=voices;
  const deferred={start:():void=>{this.thrustPending=true;queueMicrotask(()=>{if(this.thrustPending){this.thrustPending=false;this.voices?.play(this.rows.deferred.cue);}});}};
  this.cues.use(createCueRouter(this.data.routing,{voices:new Map(),bindings:this.data.voiceBindings,owners:new Map<string,object>([['voices',voices],[this.rows.deferred.owner,deferred]])}),scope);
  const animalSound=(name:string,pos:Vector3):void=>{if(name==='hoofsteps'){const who=animals?.animals.find(actor=>actor.position===pos);if(who!==undefined&&!this.rows.hoofKinds.includes(who.kind))return;}a.animal(name,pos,this.player.position,this.player.yaw);};
  if(animals!==undefined)animals.onSound=animalSound;
  a.setAmbient(voices.rows.bed);
  if(music!==undefined){const profile=requireAudioProfile(this.data.music,'scene score');this.score=SetScore.declared(profile,music);scope.onDispose(music.setScore(profile.id,this.score));a.onLevelBank(bank=>{this.score?.useBank(bank.score);},scope);}
  this.ambience=new SampledAmbience(a,requireAudioProfile(this.data.zones,'scene zones'));
  scope.onDispose(()=>{this.ambience?.dispose();this.ambience=null;if(a.hoofSurfaceAt===hoof)a.hoofSurfaceAt=previousHoof;if(a.bedId===voices.rows.bed)a.setAmbient(previousBed);if(animals?.onSound===animalSound){if(previousAnimal===undefined)delete animals.onSound;else Object.defineProperty(animals,'onSound',previousAnimal);}this.audio=null;this.voices=null;this.score=undefined;this.music=undefined;this.thrustPending=false;});
 }
 surfaceAt(x:number,z:number):HoofSurface{
  for(const row of this.rows.surfaces.rules){const hit=row.kind==='rect'?Math.abs(x-row.x)<row.width/2&&Math.abs(z-row.z)<row.depth/2:row.kind==='field'?requireAudioProfile(this.fields.get(row.id),row.id)(x,z)>row.above:row.ids.some(id=>audioPathProbe(requireAudioProfile(this.rows.paths[id],id),x,z).distance<row.below);if(hit)return row.surface;}
  return this.rows.surfaces.fallback;
 }
 emit(name:string,position:Vector3):void{if(this.voices?.rows.calls.some(row=>row.id===name))this.audio?.animal(name,position,this.player.position,this.player.yaw);}
 event(name:string,x:number,z:number):void{const cue=this.rows.events[name];if(cue!==undefined)this.voices?.play(cue,{distance:Math.hypot(x-this.player.position.x,z-this.player.position.z),pan:panFromYaw(x-this.player.position.x,z-this.player.position.z,this.player.yaw,.8)});}
 fire(id:string):boolean{return id.startsWith('cue.')&&this.cues.cue(id as `cue.${string}`);}
 impact(id:string,surface:ImpactKind,pan:number,gain:number):boolean{return id.startsWith('cue.')&&this.cues.cue(id as `cue.${string}`,{surface,pan,gain});}
 counts():Record<string,number>{return {...this.audio?.counts};}
 private value(expr:Parameters<typeof audioMixValue>[0]):number{return audioMixValue(expr,id=>requireAudioProfile(this.inputs[id],id));}
 update(dt:number,observations:Readonly<Record<string,number>>):void{
  Object.assign(this.inputs,observations);const a=this.audio,amb=this.ambience;if(a===null)return;const p=this.player.position;
  this.bedT-=dt;
  if(this.bedT<=0){
   this.bedT=1/requireAudioProfile(this.data.zones,'scene zones').tickHz;
   this.inputs['x']=p.x;this.inputs['z']=p.z;
   for(const [id,field]of this.fields)this.inputs[id]=field(p.x,p.z);
   for(const [id,row]of Object.entries(this.rows.probes)){
    let distance:number,dx:number,dz:number;
    if(row.kind==='point'){dx=row.x-p.x;dz=row.z-p.z;distance=Math.hypot(dx,dz);}
    else if(row.kind==='path'){const probe=audioPathProbe(requireAudioProfile(this.rows.paths[row.path],row.path),p.x,p.z);distance=probe.distance;dx=probe.x;dz=probe.z;}
    else{const profile=requireAudioProfile(this.rows.profiles[row.profile],row.profile),at=Math.max(0,Math.min(profile.values.length-1,(p.x-profile.x0)/profile.step)),i=Math.min(profile.values.length-2,Math.floor(at)),left=requireAudioProfile(profile.values[i],row.profile),right=requireAudioProfile(profile.values[i+1],row.profile),u=at-i;dx=0;dz=left[0]+(right[0]-left[0])*u-p.z;distance=Math.abs(dz)-(left[1]+(right[1]-left[1])*u);}
    this.inputs[`${id}.distance`]=distance;this.inputs[`${id}.pan`]=panFromYaw(dx,dz,this.player.yaw,.7);
    const blend=Math.max(0,Math.min(1,(distance-row.outer)/(row.inner-row.outer)));this.inputs[id]=blend*blend*(3-2*blend)*row.gain;
   }
   for(const [id,expr]of this.rows.values)this.inputs[id]=this.value(expr);
   this.voices?.setGroup(this.rows.voiceGroup,Object.fromEntries(this.rows.voice.map(([id,expr])=>[id,this.value(expr)])));
   if(amb!==null){for(const [id,expr]of this.rows.mix)amb.inputs[id]=this.value(expr);amb.inputs['rain']=this.voices?.observations['rain']??0;amb.inputs['storm']=this.voices?.observations['stormwind']??0;amb.set(amb.inputs);amb.mix();if(a.ready)this.voices?.sampledBed((amb.diag['sampled']??0)>0);}
   if(this.score!==undefined){const before=JSON.stringify(this.score.scene);for(const row of this.rows.score)this.score.scene[row.key]=this.value(row.when)!==0?row.on:row.off;if(amb!==null)this.score.scene['zone']=amb.zone;if(JSON.stringify(this.score.scene)!==before)this.music?.refreshScore();}
  }
  amb?.advance(dt,p,this.player.yaw);
  this.chorusT-=dt;
  if(this.chorusT<=0){const row=this.rows.chorus;this.chorusT=this.value(row.active)!==0?row.wait[0]+audioRandom()*(row.wait[1]-row.wait[0]):row.idle;if(this.value(row.when)!==0){const angle=audioRandom()*Math.PI*2,d=row.distance[0]+audioRandom()*(row.distance[1]-row.distance[0]);this.point.set(p.x+Math.cos(angle)*d,p.y+row.up,p.z+Math.sin(angle)*d);a.animal(row.call,this.point,p,this.player.yaw);}}
 }
}


const enteredScenes=new WeakMap<Scope,WeakMap<ShardProduct,AudioSceneDirector>>();
/** Z1 installs one declared director and its signal subscriptions for the entered owner. */
export function installClientAudioScene(ctx:ShardContext):void{
 const world=ctx.game.runtime?.world;if(world===undefined||world===null||ctx.scope.disposed)throw new Error('Audio scene requires an entered world');
 let products=enteredScenes.get(ctx.scope);if(products===undefined){products=new WeakMap();enteredScenes.set(ctx.scope,products);}
 if(products.has(ctx.product))throw new Error('Audio scene is already installed');
 const scene=new AudioSceneDirector(runtimeAudio(ctx,ctx.product.shardfile.audio),world.player);scene.listen(ctx);products.set(ctx.product,scene);
 const installed=products;ctx.scope.onDispose(()=>{installed.delete(ctx.product);});
}
/** Native bindings borrow the installed audio scene and supply their numeric observations. */
export function clientAudioScene(ctx:ShardContext):AudioSceneDirector{
 const scene=enteredScenes.get(ctx.scope)?.get(ctx.product);if(scene===undefined||ctx.scope.disposed)throw new Error('Audio scene is not installed');return scene;
}
/** Bind the admitted director to the actual page's native audio and cue owners.
 * Re-entry restores the same subscriptions without any content callback ports. */
export function enterClientAudioScene(ctx:ShardContext):void{
 const scene=clientAudioScene(ctx),play=ctx.game.runtime?.play;
 if(play===undefined||play===null)throw new Error('Audio scene requires its actual play owner');
 installEnteredRuntimeService(ctx,scope=>{
  scene.bind(play.audio,play.music,play.animals,scope);const point=new Vector3();
  ctx.app.events.on('creature.sound',({cue,x,y,z})=>{point.set(x,y,z);scene.emit(cue,point);},scope);
  play.cues.use((id,options)=>options.surface===undefined?scene.fire(id):scene.impact(id,options.surface==='flesh'||options.surface==='wood'?options.surface:'ground',options.pan??0,options.gain??1),scope);
 });
}
