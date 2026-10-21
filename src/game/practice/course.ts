import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomMarker } from '@wildshard/engine/ui/roomMap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { parseRidingPractice, type RidingPracticeLayout, type HookPracticeLayout, type HookPracticeRow } from '@wildshard/format/practiceCourse';
import { isJsonData } from '@wildshard/format/json';
import type { ShardContext } from '../plugin/context';
import { ReturnProgram } from '../population/returnProgram';
import { pageRidingMount } from '../riding/client';
import { GrappleTool } from '../grapple/tool';
import { buildPracticeScene } from './scene';

const fill = (text:string, values:Readonly<Record<string,string|number>>):string => text.replaceAll(/\{(\w+)\}/gu,(match,key:string)=>String(values[key]??match));

type HookCourseRow = HookPracticeRow;
type HookCoursePad = HookCourseRow['pads'][number];

/** What a course hands the tool: its name and the rings' centres, world space. */
interface HookCourseCourse {
  readonly name: string;
  readonly hooks: readonly THREE.Vector3[];
}

/** a pad of the row by id (throws on an unknown one) */
function hookCoursePad(row: HookCourseRow, id: string): HookCoursePad {
  const p = row.pads.find((q) => q.id === id);
  if (p === undefined) throw new Error(`hook course: no pad ${id}`);
  return p;
}


/** the way the player faces to look from (x, z) toward (tx, tz): Player.forward is (−sin yaw, −cos yaw) */
const yawToward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(-(tx - x), -(tz - z));

/** Numeric continuation of a mounted practice guest. No renderer or wall clock is owned here. */
export class RidingCourseRun {
  readonly state={lap:0,started:0,running:0,half:0,best:-1,last:-1,prevX:0};
  private readonly brain:ReturnProgram;
  constructor(program:unknown,scope?:Scope){this.brain=ReturnProgram.page(program,scope);}
  get best():number|null{return this.state.best<0?null:this.state.best;}
  elapsed(now:number):number{return this.state.running?now-this.state.started:0;}
  reset(x:number):void{this.project('courseReset',{courseX:x,courseY:0,courseZ:0,courseTime:0,courseMounted:0});}
  step(now:number,x:number,y:number,z:number,mounted:boolean):{fell:boolean;notice:number|null;lap:number;time:number;best:boolean}{
    const lap=this.state.lap,out=this.project('courseStep',{courseX:x,courseY:y,courseZ:z,courseTime:now,courseMounted:Number(mounted)});
    return{fell:out['courseFell']===1,notice:out['courseEvent']===1?1:out['courseEvent']===2?2:null,lap,
      time:out['courseEvent']===1?this.state.last:this.elapsed(now),best:this.state.best===this.state.last};
  }
  private project(signal:string,observed:Readonly<Record<string,number>>):Readonly<Record<string,number>>{
    const out=this.brain.project(signal,{...this.state,...observed});
    for(const key of ['lap','started','running','half','best','last','prevX']as const){
      const value=out[key];if(value===undefined)throw new Error('Missing practice continuation');this.state[key]=value;
    }
    return out;
  }
}

/** Only rows and native page authority enter the shared room lifecycle. */
export type PracticeCourseRows = { kind:'horse'; layout:unknown } | { kind:'grapple'; layout:HookPracticeLayout };
interface CourseController {
  readonly map:RoomMap;
  enter:()=>void; exit:()=>void; afterExit:()=>void; events:(active:boolean)=>void;
  restart:()=>void; update:(delta:number)=>void;
}
function prepareCourse(ctx:ShardContext,input:PracticeCourseRows):
 {kind:'horse';layout:RidingPracticeLayout;mount:ReturnType<typeof pageRidingMount>} | {kind:'grapple';layout:HookPracticeLayout} {
  if(!isJsonData(input.layout))throw new Error('Practice rows require JSON data');
  if(input.kind==='horse')return {kind:'horse',layout:parseRidingPractice(input.layout),mount:pageRidingMount(ctx)};
  hookCoursePad(input.layout.course,input.layout.course.run.from);return input;
}

class MountedCourseController implements CourseController {
  readonly map:RoomMap;
  readonly road:(readonly[number,number])[];
  private horse: Animal | null = null;
  private readonly rows: RidingPracticeLayout;
  private readonly mount: ReturnType<typeof pageRidingMount>;
  readonly run: RidingCourseRun;
  private pending = 0;

  constructor(private readonly host:PlaygroundHost,rows:RidingPracticeLayout,
    mount:ReturnType<typeof pageRidingMount>,scope:Scope,private readonly room:PracticeCourse,map:RoomMap) {
    this.rows=rows;this.mount=mount;this.run=new RidingCourseRun(rows.program,scope);
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
    this.pending=0; this.run.reset(px-o.x);
    this.room.chip.status(this.rows.words.ready);
    this.room.chip.time(0, this.run.best);
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
      const event=this.run.step(now,p.position.x-o.x,p.position.y-o.y,p.position.z-o.z,mounted);
      if(event.fell){this.restart();this.host.toast(this.rows.words.fell);return;}
      if(event.notice!==null)this.host.toast(fill(event.notice===1?this.rows.words.lapNotice:this.rows.words.halfNotice,
        {lap:event.lap,time:clock(event.time),best:event.best?this.rows.words.best:''}));
    }
    const state=this.run.state,elapsed=this.run.elapsed(now),words=this.rows.words;
    this.room.chip.time(elapsed,this.run.best);
    this.room.chip.status(!mounted&&!state.running?words.ready:!state.running?words.ride:
      fill(words.lap,{lap:state.lap,half:state.half?words.half:'',last:state.last<0?'':fill(words.last,{time:clock(state.last)})}),state.running||mounted?'go':undefined);
  }
}


class HookCourseController implements CourseController {
  readonly map:RoomMap;
  readonly hooks: THREE.Vector3[];
  private readonly host: PlaygroundHost;
  private readonly row: HookCourseRow;
  private readonly course: HookCourseCourse;
  /** the lowest pad floor: a fall `fallY` under it is a fall */
  private readonly lowest: number;
  private run: 'ready' | 'running' | 'done' = 'ready';
  private t0 = 0;
  private elapsed = 0;
  private best: number | null = null;
  /** the last pad stood on (a fall comes back here) */
  private checkpoint: HookCoursePad;
  /** pads reached this run, for the status line */
  private reached = new Set<string>();

  constructor(host:PlaygroundHost,layout:HookPracticeLayout,private readonly room:PracticeCourse,map:RoomMap) {
    this.host=host;this.row=layout.course;this.map=map;
    this.lowest=Math.min(...this.row.pads.map(p=>p.top));this.checkpoint=hookCoursePad(this.row,this.row.run.from);
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

  /** ↺: back on the start facing its next pad, the run reset */
  restart(): void {
    this.run = 'ready'; this.elapsed = 0; this.reached.clear();
    this.checkpoint = hookCoursePad(this.row, this.row.run.from);
    this.place(this.checkpoint, true);
    this.room.chip.status(this.row.words.ready);
    this.room.chip.time(0, this.best);
  }

  /** on a pad's floor facing its next pad's hook (the start: 3 m in from its near end, the next pad dead ahead) */
  private place(p: HookCoursePad, atStart: boolean): void {
    const o = this.room.origin, player = this.host.player;
    const x = p.x, z = atStart ? p.z + p.d / 2 - 3 : p.z;
    const next = p.next === undefined ? null : hookCoursePad(this.row, p.next);
    const yaw = next === null ? 0 : yawToward(x, z, next.x, next.z);
    player.spawn(o.x + x, o.z + z, yaw, o.y + p.top);
    player.velocity.set(0, 0, 0);
    player.pitch = next === null ? -0.1 : Math.atan2(next.top - p.top, Math.hypot(next.x - x, next.z - z)) * 0.8;
  }

  /** the pad under the feet (on its floor), or null — the run's clock reads it, and so do the tests */
  padUnder(): HookCoursePad | null {
    const o = this.room.origin, p = this.host.player.position;
    const lx = p.x - o.x, ly = p.y - o.y, lz = p.z - o.z;
    for (const pad of this.row.pads) {
      if (Math.abs(lx - pad.x) <= pad.w / 2 && Math.abs(lz - pad.z) <= pad.d / 2 && Math.abs(ly - pad.top) < 0.35) return pad;
    }
    return null;
  }

  update(_delta:number): void {
    const { player } = this.host;
    const row = this.row, words = row.words;
    if (player.hover) player.setHover(false); // no board in the dev room (as in the Practice arena)
    const o = this.room.origin, p = player.position;
    const pad = player.onGround ? this.padUnder() : null;
    if (pad !== null) {
      this.checkpoint = pad;
      if (pad.kind !== 'start' && pad.kind !== 'range') this.reached.add(pad.id);
    }
    // the run starts across the start's line (its far edge, toward the next pad; a range line off its west side does not
    // count) and stops on the finish pad
    const s = hookCoursePad(row, row.run.from);
    if (this.run === 'ready' && p.z - o.z < s.z - s.d / 2 && p.x - o.x > s.x - s.w / 2 - 1) { this.run = 'running'; this.t0 = performance.now(); }
    if (this.run === 'running') {
      this.elapsed = (performance.now() - this.t0) / 1000;
      if (pad?.id === row.run.to) {
        this.run = 'done';
        this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
        const time = clock(this.elapsed);
        this.room.chip.status(fill(words.finish, { time }), 'done');
        this.host.toast(fill(words.done, { time, best: this.best === this.elapsed ? words.best : '' }));
      } else this.room.chip.status(pad !== null ? fill(words.running, { pad: pad.label }) : fill(words.between, { reached: this.reached.size, goals: row.run.goals }), 'go');
    }
    this.room.chip.time(this.elapsed, this.best);
    // a fall into the pit: back on the last pad, facing its next hook
    if (p.y < o.y + this.lowest - row.fallY) {
      this.place(this.checkpoint, this.checkpoint.id === row.run.from);
      this.host.toast(fill(words.fell, { pad: this.checkpoint.label }));
    }
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
    this.controller=data.kind==='horse'?new MountedCourseController(host,data.layout,data.mount,ctx.scope,this,map):new HookCourseController(host,data.layout,this,map);
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
