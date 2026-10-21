import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomMarker } from '@wildshard/engine/ui/roomMap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { RidingPracticeLayout, HookPracticeLayout, HookPracticeRow } from '@wildshard/format/practiceCourseRows';
import { isJsonData } from '@wildshard/format/json';
import type { GrappleCourseRow } from '@wildshard/format/grapple';
import type { ShardContext } from '../plugin/context';
import { ProjectedState, ReturnProgram } from '../population/returnProgram';
import { pageRidingMount } from '../riding/client';
import { GrappleTool } from '../grapple/tool';
import { buildPracticeScene } from './scene';

const fill = (text:string, values:Readonly<Record<string,string|number>>):string => text.replaceAll(/\{(\w+)\}/gu,(match,key:string)=>String(values[key]??match));

type HookCourseRow = HookPracticeRow;
type HookCoursePad = HookCourseRow['pads'][number];

/** Only rows and native page authority enter the shared room lifecycle. */
export type PracticeCourseRows = { kind:'horse'; layout:RidingPracticeLayout } | { kind:'grapple'; layout:HookPracticeLayout };
interface CourseController {
  readonly map:RoomMap;
  enter:()=>void; exit:()=>void; afterExit:()=>void; events:(active:boolean)=>void;
  restart:()=>void; update:(delta:number)=>void;
}
function prepareCourse(ctx:ShardContext,input:PracticeCourseRows):
 {kind:'horse';layout:RidingPracticeLayout;mount:ReturnType<typeof pageRidingMount>} | {kind:'grapple';layout:HookPracticeLayout;law:ReturnProgram} {
  if(!isJsonData(input.layout))throw new Error('Practice rows require JSON data');
  if(input.kind==='horse')return {kind:'horse',layout:input.layout,mount:pageRidingMount(ctx)};
  return {...input,law:ReturnProgram.page(input.layout.program,ctx.scope)};
}

class MountedCourseController implements CourseController {
  readonly map:RoomMap;
  readonly road:(readonly[number,number])[];
  private horse: Animal | null = null;
  private readonly rows: RidingPracticeLayout;
  private readonly mount: ReturnType<typeof pageRidingMount>;
  readonly run:ProjectedState<{lap:number;started:number;running:number;half:number;best:number;last:number;prevX:number}>;
  private pending = 0;

  constructor(private readonly host:PlaygroundHost,rows:RidingPracticeLayout,
    mount:ReturnType<typeof pageRidingMount>,scope:Scope,private readonly room:PracticeCourse,map:RoomMap) {
    this.rows=rows;this.mount=mount;this.run=new ProjectedState({initial:{lap:0,started:0,running:0,half:0,best:-1,last:-1,prevX:0},
      signals:{reset:'courseReset',step:'courseStep'}},ReturnProgram.page(rows.program,scope));
    const o=room.origin,lap=rows.road.map(([x,z])=>[o.x+x,o.z+z]as const);this.road=[...lap,...lap.slice(1)];
    const mark:RoomMarker={x:0,z:0},marks=[mark],none:RoomMarker[]=[];
    this.map={...map,markers:()=>{const h=this.horse;if(h===null||h.hidden)return none;mark.x=h.position.x;mark.z=h.position.z;return marks;}};
  }


  enter():void {
    const horse=this.horse??this.spawnHorse();horse.hidden=false;horse.mesh.visible=true;
    this.mount.addMountable(horse.entityId,this.rows.actor.name);this.mount.setRoads([this.road]);
  }
  exit():void {
    const mount=this.mount,horse=this.horse;
    if(horse!==null){if(mount.horse===horse)mount.dismount();mount.removeMountable(horse.entityId);mount.setRoads(null);horse.hidden=true;horse.mesh.visible=false;}
  }
  afterExit():void { /* Mounted cleanup precedes the common room hide. */ }
  events(_active:boolean):void { /* Mounted listeners use the existing practice-room DOM event. */ }

  /** the saddled horse, spawned once through the shard's AnimalManager (its rig, its sounds, its hit tests) */
  private spawnHorse(): Animal {
    const a = this.host.animals.spawn(this.rows.actor.kind, this.rows.fieldAt.x + this.rows.horseStart.x, this.rows.fieldAt.z + this.rows.horseStart.z, this.rows.horseStart.yaw, this.rows.actor.variant);
    this.horse = a;
    return a;
  }

  /** stand the horse on the field at (x, z): the field is PLAYGROUND_Y up, the terrain under it is not its ground */
  private standHorse(a: Animal, x: number, z: number, yaw: number): void {
    a.place(x, z, yaw);
    a.yOffset = PLAYGROUND_Y - heightAt(x, z);
    a.position.y = PLAYGROUND_Y;
    a.levelGround = true;
    a.hp = a.maxHp;             // whole again: under 20 % Mount's bolt would run it for the camp's rail, far below the field
    a.speed = 0;
    a.setMotion(yaw, 0, 2);
    a.mesh.position.copy(a.position);
  }

  /** ↺: off the horse, the horse back on the start facing east, you by its left side; the laps reset */
  restart(): void {
    const mount = this.mount, a = this.horse;
    if (a === null) return;
    if (mount.horse === a) mount.dismount();
    const o = this.room.origin;
    this.standHorse(a, o.x + this.rows.horseStart.x, o.z + this.rows.horseStart.z, this.rows.horseStart.yaw);
    const px = o.x + this.rows.riderStart.x, pz = o.z + this.rows.riderStart.z;
    // face the horse's shoulder: Player.forward is (−sin yaw, −cos yaw)
    const yaw = Math.atan2(-(a.position.x + this.rows.shoulder - px), -(a.position.z - pz));
    this.host.player.spawn(px, pz, yaw, o.y);
    this.host.player.pitch = this.rows.riderPitch;
    this.pending=0;this.run.event('reset',{courseX:px-o.x,courseY:0,courseZ:0,courseTime:0,courseMounted:0});
    this.room.chip.status(this.rows.words.ready);
    this.room.chip.time(0,this.run.state.best<0?null:this.run.state.best);
  }

  update(dt:number): void {
    const mount = this.mount, a = this.horse, p = this.host.player;
    if (a === null) return;
    if (p.hover) p.setHover(false);
    const o = this.room.origin;
    // unridden, the horse stands on the field (a dismount hands it back to the terrain's tilt: level it again)
    // — and at the field's height where it stands now: its ground follow tracks the terrain 3 km under it, so the offset
    // taken on the start would float or sink it anywhere else (a dismount mid-lap; E321 / E328)
    if (mount.horse !== a) { a.levelGround = true; a.yOffset = PLAYGROUND_Y - heightAt(a.position.x, a.position.z); }
    const mounted = this.host.player.mountedOn === a;
    const now=performance.now()/1000;
    this.pending+=dt;
    if(this.pending>=.1){
      this.pending=0;
      const lap=this.run.state.lap,out=this.run.event('step',{courseTime:now,courseX:p.position.x-o.x,courseY:p.position.y-o.y,courseZ:p.position.z-o.z,courseMounted:Number(mounted)});
      if(out['courseFell']===1){this.restart();this.host.toast(this.rows.words.fell);return;}
      const notice=out['courseEvent'],state=this.run.state;
      if(notice===1||notice===2)this.host.toast(fill(notice===1?this.rows.words.lapNotice:this.rows.words.halfNotice,
        {lap,time:clock(notice===1?state.last:state.running?now-state.started:0),best:state.best===state.last?this.rows.words.best:''}));
    }
    const state=this.run.state,elapsed=state.running?now-state.started:0,words=this.rows.words;
    this.room.chip.time(elapsed,state.best<0?null:state.best);
    this.room.chip.status(!mounted&&!state.running?words.ready:!state.running?words.ride:
      fill(words.lap,{lap:state.lap,half:state.half?words.half:'',last:state.last<0?'':fill(words.last,{time:clock(state.last)})}),state.running||mounted?'go':undefined);
  }
}


class HookCourseController implements CourseController {
  readonly map:RoomMap;
  readonly hooks: THREE.Vector3[];
  private readonly host: PlaygroundHost;
  private readonly row: HookCourseRow;
  private readonly course: GrappleCourseRow;
  private readonly frame:Readonly<Record<string,number>>;
  private readonly law:ProjectedState<{phase:number;started:number;elapsed:number;best:number;checkpoint:number}>;
  private get state(){return this.law.state;}
  private readonly reached=new Set<string>();

  constructor(host:PlaygroundHost,layout:HookPracticeLayout,program:ReturnProgram,private readonly room:PracticeCourse,map:RoomMap) {
    this.host=host;this.row=layout.course;this.map=map;
    this.law=new ProjectedState({initial:{phase:0,started:0,elapsed:0,best:-1,checkpoint:0}},program);
    this.frame=layout.frame;
    const o=room.origin;this.hooks=layout.hooks.map(h=>new THREE.Vector3(o.x+h.x,o.y+h.y,o.z+h.z));
    this.course={name:room.title,hooks:this.hooks};
  }

  private tool(): GrappleTool {
    const tool = this.host.game.app.equipment?.tools.find(item => item instanceof GrappleTool);
    if (!(tool instanceof GrappleTool)) throw new Error('Hook practice needs the equipped grapple tool');
    return tool;
  }

  enter():void {this.tool().setGrappleCourse(this.course);}
  exit():void { /* Grapple cleanup follows the common room hide. */ }
  events(active:boolean):void {app.events.emit('practice.active',active);}
  afterExit():void {this.tool().setGrappleCourse(null);}

  /** The guest resets its continuation; the native presenter moves the body. */
  restart(): void {
    this.law.reset({...this.state});this.reached.clear();this.place(this.project('reset'));
    this.room.chip.status(this.row.words.ready);this.room.chip.time(0,this.best);
  }
  private get best():number|null {return this.state.best<0?null:this.state.best;}
  private pad(index:number):HookCoursePad {
    const pad=this.row.pads[index];if(pad===undefined)throw new Error('Invalid practice checkpoint');return pad;
  }
  private project(signal:string,delta?:number):Readonly<Record<string,number>> {
    const player=this.host.player,p=player.position,o=this.room.origin;
    const frame={...this.frame,now:performance.now()/1000,x:p.x-o.x,y:p.y-o.y,z:p.z-o.z,grounded:Number(player.onGround)};
    return delta===undefined?this.law.event(signal,frame):this.law.step(delta,frame).values;
  }

  /** The guest chooses the checkpoint pose; the native player keeps its existing spawn and velocity owner. */
  private place(out:Readonly<Record<string,number>>):void {
    const value=(key:string):number=>{const n=out[key];if(n===undefined)throw new Error('Missing practice spawn channel');return n;};
    const o=this.room.origin,player=this.host.player;
    player.spawn(o.x+value('spawnX'),o.z+value('spawnZ'),value('spawnYaw'),o.y+value('spawnY'));
    player.velocity.set(0,0,0);player.pitch=value('spawnPitch');
  }

  update(delta:number): void {
    const {player}=this.host,row=this.row,words=row.words;
    if(player.hover)player.setHover(false);
    const out=this.project('step',delta),index=out['pad']??-1,pad=index<0?null:this.pad(index);
    if(Object.keys(out).length>0) {
      const visit=out['visit'];if(visit!==undefined&&visit>=0)this.reached.add(this.pad(visit).id);
      if(out['finish']===1) {
        const time=clock(this.state.elapsed);
        this.room.chip.status(fill(words.finish,{time}),'done');
        this.host.toast(fill(words.done,{time,best:this.best===this.state.elapsed?words.best:''}));
      } else if(this.state.phase===1) this.room.chip.status(pad!==null?fill(words.running,{pad:pad.label}):fill(words.between,{reached:this.reached.size,goals:row.run.goals}),'go');
      if(out['fell']===1) {
        const checkpoint=this.pad(this.state.checkpoint);
        this.place(out);this.host.toast(fill(words.fell,{pad:checkpoint.label}));
      }
    }
    const elapsed=this.state.phase===1?performance.now()/1000-this.state.started:this.state.elapsed;
    this.room.chip.time(elapsed,this.best);
  }
}


/** Client-only common room lifetime, shared by the real riding and grapple courses.
 * Per-family controllers keep their existing laws and remain separately attributed. */
export class PracticeCourse implements Playground {
  readonly id:'horse'|'grapple'; readonly title:string; readonly center:{x:number;z:number};
  readonly root:THREE.Group; readonly map:RoomMap; readonly origin:THREE.Vector3; readonly chip:PlaygroundChip;
  private active=false;
  private readonly controller:CourseController;
  constructor(private readonly host:PlaygroundHost,ctx:ShardContext,input:PracticeCourseRows) {
    const data=prepareCourse(ctx,input),row=data.kind==='horse'?data.layout:data.layout.course;
    this.id=data.kind;this.title=row.title;
    this.center=data.kind==='horse'?{...data.layout.fieldAt}:{...host.spawn};
    this.origin=new THREE.Vector3(this.center.x,PLAYGROUND_Y,this.center.z);
    const {root,colliders,map}=buildPracticeScene(data.layout.presentation,this.origin,row.piece.id);
    this.root=root;root.visible=false;
    host.registry.add({id:row.piece.id,name:row.piece.name,category:'ground',file:row.piece.file,object:root,colliders,surface:data.kind==='horse'?'wood':'metal',solidFloor:true});
    this.chip=new PlaygroundChip(row.chip,()=>{this.restart();});
    this.controller=data.kind==='horse'?new MountedCourseController(host,data.layout,data.mount,ctx.scope,this,map):new HookCourseController(host,data.layout,data.law,this,map);
    this.map=this.controller.map;
    host.game.onUpdate(dt=>{if(this.active)this.controller.update(dt);},row.piece.id);
  }
  get entered():boolean{return this.active;}
  enter():void {
    this.active=true;app.setState('playground');this.root.visible=true;this.controller.enter();
    practiceFps.on=true;playgroundActive(true);this.controller.events(true);
    this.host.player.setHover(false);this.chip.show(true);this.restart();
  }
  exit():void {
    if(!this.active)return;
    this.active=false;app.setState('play');this.controller.exit();this.root.visible=false;
    this.chip.show(false);playgroundActive(false);this.controller.events(false);practiceFps.on=false;this.controller.afterExit();
  }
  restart():void {this.controller.restart();}
}
