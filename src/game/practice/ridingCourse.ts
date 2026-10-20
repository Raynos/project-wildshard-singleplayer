import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomMarker } from '@wildshard/engine/ui/roomMap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { buildPracticeScene } from '@wildshard/game/practice/scene';
import * as THREE from 'three';
import { parseRidingPractice, type RidingPracticeLayout } from '@wildshard/format/practiceCourse';
import { pageRidingMount } from '../riding/client';
import { ReturnProgram } from '../population/returnProgram';
import type { ShardContext } from '../plugin/context';

const fill = (text:string, values:Readonly<Record<string,string|number>>):string => text.replaceAll(/\{(\w+)\}/gu,(match,key:string)=>String(values[key]??match));

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

/** Client-only mounted course; native riding and an admitted guest own all actions. */

export class RidingCoursePlayground implements Playground {
  readonly id = 'horse' as const;
  readonly title: string;
  readonly center: { x: number; z: number };
  readonly root: THREE.Group;
  /** the field's own map (E321): the walls, the oval and its posts, the start / finish and half-way lines, the jump rails,
   *  the horse — the minimap draws this while you ride, not the steppe 3 km under the field */
  readonly map: RoomMap;
  /** the track's centre line, world x / z, two laps long (the road wraps past the line) */
  readonly road: (readonly [number, number])[];
  private horse: Animal | null = null;
  private readonly chip: PlaygroundChip;
  private active = false;
  private readonly rows: RidingPracticeLayout;
  private readonly mount: ReturnType<typeof pageRidingMount>;
  readonly run: RidingCourseRun;
  private pending = 0;

  constructor(private readonly host: PlaygroundHost, ctx: ShardContext, input: unknown) {
    const rows = parseRidingPractice(input); this.rows=rows; this.title=rows.title;
    this.mount=pageRidingMount(ctx); this.run=new RidingCourseRun(rows.program,ctx.scope);
    this.origin = new THREE.Vector3(rows.fieldAt.x, PLAYGROUND_Y, rows.fieldAt.z);
    this.center = { x: this.rows.fieldAt.x, z: this.rows.fieldAt.z };
    const o = this.origin;
    const { root, colliders, map } = buildPracticeScene(rows.presentation, o, rows.piece.id);
    this.root = root;
    root.visible = false;
    host.registry.add({ id: rows.piece.id, name: rows.piece.name, category: 'ground', file: rows.piece.file, object: root, colliders, surface: 'wood', solidFloor: true });
    const lap = rows.road.map(([x, z]) => [o.x + x, o.z + z] as const);
    this.road = [...lap, ...lap.slice(1)];
    const mark: RoomMarker = { x: 0, z: 0 }, marks = [mark], none: RoomMarker[] = [];   // reused: read every frame
    this.map = { ...map, markers: () => { const h = this.horse; if (h === null || h.hidden) return none; mark.x = h.position.x; mark.z = h.position.z; return marks; } };
    this.chip = new PlaygroundChip(rows.chip, () => { this.restart(); });
    host.game.onUpdate(dt => { if (this.active) this.update(dt); }, rows.piece.id);
  }

  get entered(): boolean { return this.active; }

  /** the field's floor centre, world space (one vector: update() reads it every frame) */
  private readonly origin: THREE.Vector3;

  enter(): void {
    const mount = this.mount;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    const horse = this.horse ?? this.spawnHorse();
    horse.hidden = false; horse.mesh.visible = true;
    mount.addMountable(horse.entityId, this.rows.actor.name);
    mount.setRoads([this.road]);             // the track is the road while the field is open (B1's keep-to-the-road)
    practiceFps.on = true;                        // a small scene: mobile runs it at 60 (tier.ts, as the Practice arena)
    playgroundActive(true);
    this.host.player.setHover(false);
    this.chip.show(true);
    this.restart();
  }

  exit(): void {
    if (!this.active) return;
    const mount = this.mount, horse = this.horse;
    this.active = false;
    app.setState('play');
    if (horse !== null) {
      if (mount.horse === horse) mount.dismount();
      mount.removeMountable(horse.entityId);
      mount.setRoads(null);
      horse.hidden = true; horse.mesh.visible = false;
    }
    this.root.visible = false;
    this.chip.show(false);
    playgroundActive(false);
    practiceFps.on = false;
  }

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
    const o = this.origin;
    this.standHorse(a, o.x + this.rows.horseStart.x, o.z + this.rows.horseStart.z, this.rows.horseStart.yaw);
    const px = o.x + this.rows.riderStart.x, pz = o.z + this.rows.riderStart.z;
    // face the horse's shoulder: Player.forward is (−sin yaw, −cos yaw)
    const yaw = Math.atan2(-(a.position.x + this.rows.shoulder - px), -(a.position.z - pz));
    this.host.player.spawn(px, pz, yaw, o.y);
    this.host.player.pitch = this.rows.riderPitch;
    this.pending=0; this.run.reset(px-o.x);
    this.chip.status(this.rows.words.ready);
    this.chip.time(0, this.run.best);
  }

  private update(dt:number): void {
    const mount = this.mount, a = this.horse, p = this.host.player;
    if (a === null) return;
    if (p.hover) p.setHover(false);
    const o = this.origin;
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
    this.chip.time(elapsed,this.run.best);
    this.chip.status(!mounted&&!state.running?words.ready:!state.running?words.ride:
      fill(words.lap,{lap:state.lap,half:state.half?words.half:'',last:state.last<0?'':fill(words.last,{time:clock(state.last)})}),state.running||mounted?'go':undefined);
  }
}

