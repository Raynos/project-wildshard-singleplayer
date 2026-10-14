import { bindDirectorActions,type BoundDirectorActions } from '@wildshard/game/plugin/director';
import preludeRows from '../data/elitePreludeStages.json' with {type:'json'};
import type { Vector3 } from 'three';
import { EliteBrain, type EliteActor } from '@wildshard/engine/ai/EliteBrain';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { BEAR_CAVE } from '../data/layout';
import { moduleBytes, stepEliteScript, EliteScriptLane, type EliteScriptPorts } from '@wildshard/game/plugin/brain';
import { PINE_ELITE_FIGHTS, PINE_ELITE_MODULES } from '../data/eliteBrainRows';
import { PINE_ELITE_HOSTS } from '../data/eliteHostRows';
import { PINE_ELITE_ANIMALS, PINE_ELITE_DEFS } from './eliteRoster';
import { pineEliteStreams, type PineEliteStreams } from './eliteStreams';
import { behindPlayer, bugleHour, fadeCooldown, headingTo } from './combatMath';
import { PINE_LANES, PINE_STRIKES, pineContact } from './strikes';
import type { Lane, LaneBody } from './lane';

/**
 * Pine Hollow's four named elites' scripts, renderer-free (SF72): Old Ironhide, the Ghost Stag, Old Blackpaw and the Imperial
 * Bull as one implementation over any body and world (each satisfies the game's `EliteCoreScript`). The page (elites.ts) gives them its Animals, its decals, puffs and voices;
 * a renderer-free host (runtime/elites.ts) gives them its bodies, bare lanes and silent effects. Every random draw is the elite's
 * own seeded stream (eliteStreams.ts). The rules around them (lair, aware / engaged / leash, phase 2, respawn) are the game's
 * `EliteCore` (@wildshard/game/eliteSystem). Their fights — the moves and clocks — are admitted elite scripts (SF27:
 * behaviour/<name>.as, data/eliteBrains.ts); the author rows assemble their hosts (spawn, lair, tells, the actions a script names)
 * and keep the continuation's field names. The behaviour is told in elites.ts.
 */

/** An elite's body as the scripts drive it: the page's Animal and a renderer-free host's body alike. */
export interface PineEliteBody extends LaneBody, EliteActor {
  readonly alive: boolean; readonly position: Vector3; readonly entityId: string;
  hidden: boolean; hp: number; readonly maxHp: number; readonly kind: string;
  place: (x: number, z: number, yaw: number, y?: number) => void;
}

/** One of the authored lane charges (strikes.ts PINE_LANES). */
export type PineLaneRow = (typeof PINE_LANES)[keyof typeof PINE_LANES];

/** A ring telegraph (the page's GroundTell ring; a renderer-free host draws nothing). */
export interface PineRingTell { setTime: (t: number) => void; ring: (x: number, z: number, radius: number, alpha: number) => void; hide: () => void }

/** What the scripts touch of the world: the player, the fight's effects on them, the creature manager, the tells and the effects. */
export interface PineEliteWorld<B extends PineEliteBody> {
  readonly player: { readonly position: Vector3; readonly yaw: number };
  reach: (actor: B, target: { readonly x: number; readonly y: number; readonly z: number }) => boolean;
  readonly god: boolean;
  trauma: (k: number) => void; stun: (s: number) => void;
  dusk: () => number; night: () => number;
  /** `a` hits the player for `dmg` */
  hurt: (a: B, dmg: number, throughWalls?: boolean) => void;
  /** an animal voice at the body */
  voice: (name: string, a: B) => void;
  /** the creature manager's spawn (the shared creature stream's draws) */
  spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => B;
  /** the manager's live body under an entity id (a continuation's rivals; null when none) */
  find: (entityId: string) => B | null;
  /** take a body under a fight's control (out of its herd, the manager's AI off) / hand it back / out of the world */
  own: (a: B) => void; release: (a: B) => void; retire: (a: B) => void;
  /** one of the named elites (the page: its skin comes from the orb) */
  adopt: (a: B) => void;
  lane: (row: PineLaneRow) => Lane<B>;
  ring: () => PineRingTell;
  heightAt: (x: number, z: number) => number;
  inChunk: (x: number, z: number, margin: number) => boolean;
  /** the body's view on / off (hidden in the cave, faded) */
  show: (a: B, visible: boolean) => void;
  readonly fx: { fade: (a: B) => void; reappear: (a: B) => void; burstOut: (a: B) => void; roar: (a: B, radius: number) => void };
  /** the elite system's signature flash */
  signature: (id: string) => void;
  /** the kill feed */
  feed: (text: string) => void;
}

/** where Blackpaw waits: a step inside the cave mouth (the mouth faces SE: (−sin rot, −cos rot)) */
export const BLACKPAW_MOUTH = { x: BEAR_CAVE.x - Math.sin(BEAR_CAVE.rot) * 1.5, z: BEAR_CAVE.z - Math.cos(BEAR_CAVE.rot) * 1.5 };
const MOUTH = BLACKPAW_MOUTH;
const NEVER=-1e6;
interface Rival<B extends PineEliteBody>{a:B;lane:Lane<B>;mode:'approach'|'charge'}

/** A script's own state beyond its brain's, as plain values (a renderer-free continuation). */
export type PineEliteFields = Record<string, number | boolean | null>;

/** One named elite: the shared brain (lair wander, home, phase) over its seeded streams, its spawn, despawn and trophy. */
export class PineEliteScript<B extends PineEliteBody> extends EliteBrain<B> {
  override mode = 'idle';
  override modeT = 0;
  override p2 = false;
  voice(name: string, a: B): void { this.env.voice(name, a); }
  next(): number { return this.streams.fight.next(); }
  protected readonly who: (typeof PINE_ELITE_ANIMALS)[string];
  readonly streams: PineEliteStreams;
  override readonly def: (typeof PINE_ELITE_DEFS)[string];
  readonly env: PineEliteWorld<B>;
  /** the elite's admitted fight script (its slots are the fight's state) */
  readonly script: EliteScriptLane;
  /** Authored outer encounter selection, distinct from the existing admitted fight script. */
  readonly prelude: BoundDirectorActions;
  private readonly preludeObservation={alive:false,engaged:false,leashing:false};
  private readonly rule:NonNullable<(typeof PINE_ELITE_HOSTS)[string]>;
  private readonly nativeLanes:readonly Lane<B>[];
  private readonly ring:PineRingTell|null;
  rivals:Rival<B>[]=[];
  private frameDt = 0;
  private frameTime = 0;
  constructor(id: string, env: PineEliteWorld<B>, seed?: number) {
    const rule=PINE_ELITE_HOSTS[id],row=PINE_ELITE_FIGHTS[id];
    if(rule===undefined||row===undefined)throw new Error(`Missing elite host row '${id}'`);
    const def = PINE_ELITE_DEFS[id];
    if (def === undefined) throw new Error(`no elite '${id}'`);
    // the level seed's own streams (eliteStreams.ts), never Math.random or the page's salted ones: the same elite every boot
    const streams = pineEliteStreams(def.id, seed);
    super(def, { player: env.player, random: () => streams.fight.next() }); this.def = def; this.env = env;
    this.streams = streams;
    if(preludeRows.stages.some(stage=>stage.do.length>3))throw new Error('Pine elite prelude action bound');
    const actions={
      'pine.elite.clock':()=>{this.modeT+=this.frameDt;},
      'pine.elite.clear':()=>{this.clearTells();},
      'pine.elite.home':()=>{this.goHome(this.preludeBody());},
      'pine.elite.fight':()=>{this.fight(this.preludeBody(),this.frameDt,this.frameTime);},
      'pine.elite.idle':()=>{this.idle(this.preludeBody(),this.frameDt);},
    };
    this.prelude=bindDirectorActions(preludeRows,{read:()=>this.preludeObservation,
      initial:[this.preludeObservation],bindings:Object.entries(actions).map(([emit,run])=>({action:{emit,value:0},run}))});
    const bytes = PINE_ELITE_MODULES[row.module];
    if (bytes === undefined) throw new Error(`pine elite '${id}' has no module`);
    this.script = new EliteScriptLane(row,moduleBytes(bytes),()=>streams.fight.next());
    const who = PINE_ELITE_ANIMALS[def.id];
    if (who === undefined) throw new Error(`pine elite '${def.id}' has no animal`);
    this.who = who;this.rule=rule;
    if(row.actions.some(name=>!rule.actions.includes(name)))throw new Error('Unbound elite native action');
    if(rule.leashParameter!==null&&row.parameters[rule.leashParameter]!==def.leashR)throw new Error('Elite script leash differs from its lair');
    if(rule.slots.some(slot=>!this.script.data.slots.some(field=>field.field===slot.field)))throw new Error('Undeclared elite saved slot');
    this.ring=rule.ring?env.ring():null;this.nativeLanes=rule.lanes.map(key=>env.lane(PINE_LANES[key]));
  }
  override spawn(): void {
    const L = this.def.lair;
    const a = this.env.spawn(this.who.kind, L.x, L.z, this.streams.spawn.next() * Math.PI * 2, this.who.variant);
    this.env.own(a); this.env.adopt(a);
    this.animal = a; this.p2 = false; this.setMode('idle'); this.wx = L.x; this.wz = L.z; this.wanderT = 0;
    pinBrain(a); inspectBrain(a, () => ({ state: this.brainState, picks: [], brainHz: 60, pinned: true }));
    this.onSpawn(a);
  }
  protected onSpawn(a:B):void {
    if(this.rule.hitSlot!==null){this.script.setSlot(this.rule.hitSlot,Math.max(NEVER,a.lastHitT));this.script.setSlot('cd',3);}
    if(this.rule.home==='cave')this.lurk(a);
  }
  override despawn(): void { if(this.rule.rivals)this.releaseRivals(); this.clearTells(); if (this.animal) this.env.retire(this.animal); this.animal = null; }
  // the trophy is the kill feed's line and the journal's wall (TAKEN), not a pack item: Mott has no use for it (E314 C)
  trophy(): void { this.clearTells(); this.env.feed(`${this.def.drop.trophyName ?? 'Felled'} — ${this.def.name}`);if(this.rule.rivals)this.releaseRivals(); }
  sig(): void { this.env.signature(this.def.id); }
  hurt(a: B, dmg: number, throughWalls = false): void { this.env.hurt(a, dmg, throughWalls); }
  /** dev / captures: run its signature move now */
  force(move:string):void {
    const a=this.animal;if(a===null)return;
    if(this.rule.force==='fade'){this.vanish(a);this.script.setSlot('fadeT',2);this.script.setSlot('cd',fadeCooldown(this.p2));this.setMode('faded');this.sig();return;}
    if(this.rule.home==='cave'&&a.hidden)this.burstOut(a);
    if(move===this.rule.special)this.setMode(move);else {const p=this.env.player.position;this.lane(0).start(a,p.x,p.z,60);this.setMode('charge');}
  }
  override reset():void {super.reset();if(this.rule.rivals){this.releaseRivals();this.script.setSlot('bugledPhase',-1);}}
  private lane(index:number):Lane<B> {const lane=this.nativeLanes[index];if(lane===undefined)throw new Error('Missing elite lane');return lane;}
  protected override clearTells():void {
    const a=this.animal;if(this.rule.force==='fade'&&a!==null&&this.mode==='faded')this.reappear(a,a.position.x,a.position.z);
    this.ring?.hide();this.nativeLanes[0]?.cancel();if(this.rule.cancelSlot!==null)this.script.setSlot(this.rule.cancelSlot,-1);
  }
  protected override idle(a:B,dt:number):void {
    if(this.rule.home!=='cave'){super.idle(a,dt);return;}
    if(this.mode==='lurk')return;
    const distance=Math.hypot(MOUTH.x-a.position.x,MOUTH.z-a.position.z);
    if(distance>2.5){a.setMotion(headingTo(a.position.x,a.position.z,MOUTH.x,MOUTH.z),2.2,2);return;}
    if(a.position.distanceTo(this.env.player.position)>35)this.lurk(a);else super.idle(a,dt);
  }
  /** the brain's and the script's own state (its lanes ride `lanes()`) */
  /** Advance at the original owner phase; rows select the same ordered native actions. */
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    this.frameDt = dt; this.frameTime = t;
    this.preludeObservation.alive=this.animal?.alive===true;this.preludeObservation.engaged=engaged;this.preludeObservation.leashing=leashing;
    this.prelude.advance();
  }
  private preludeBody(): B {
    const animal = this.animal;
    if (animal === null || !animal.alive) throw new Error('Pine elite prelude requires its live native body');
    return animal;
  }
  fields(): PineEliteFields { return { modeT: this.modeT, p2: this.p2, wx: this.wx, wz: this.wz, wanderT: this.wanderT, ...this.extra() }; }
  restoreFields(mode: string, f: PineEliteFields): void {
    const num = (k: string): number => { const v = f[k]; if (typeof v !== 'number') throw new Error(`Incompatible Pine elite field ${k}`); return v; };
    const bool = (k: string): boolean => { const v = f[k]; if (typeof v !== 'boolean') throw new Error(`Incompatible Pine elite field ${k}`); return v; };
    this.mode = mode; this.modeT = num('modeT'); this.p2 = bool('p2'); this.wx = num('wx'); this.wz = num('wz'); this.wanderT = num('wanderT');
    this.restoreExtra(num, bool, f);
  }
  protected extra():PineEliteFields {
    const out:PineEliteFields={};
    for(const slot of this.rule.slots){const value=this.script.slot(slot.field);out[slot.field]=slot.kind==='boolean'?value!==0:slot.never!==null&&value<=slot.never?null:value;}
    if(this.rule.hidden)out['hidden']=this.animal?.hidden===true;
    if(this.rule.rivals)this.nativeLanes.slice(1).forEach((lane,i)=>{const rival=this.rivals.find(row=>row.lane===lane),n=rival===undefined?null:Number(/^creature:(\d+)$/u.exec(rival.a.entityId)?.[1]);if(n!==null&&!Number.isInteger(n))throw new Error(`Unsaveable Imperial Bull rival ${rival?.a.entityId??''}`);out[`rival${String(i)}`]=n;out[`rivalCharge${String(i)}`]=rival?.mode==='charge';});
    return out;
  }
  protected restoreExtra(num:(key:string)=>number,bool:(key:string)=>boolean,raw:PineEliteFields):void {
    for(const slot of this.rule.slots)this.script.setSlot(slot.field,slot.kind==='boolean'?(bool(slot.field)?1:0):raw[slot.field]===null&&slot.never!==null?slot.never:num(slot.field));
    const a=this.animal;if(this.rule.hidden&&a!==null){a.hidden=bool('hidden');this.env.show(a,!a.hidden);}
    if(this.rule.rivals){this.rivals=[];this.nativeLanes.slice(1).forEach((lane,i)=>{if(raw[`rival${String(i)}`]===null)return;const id=`creature:${String(num(`rival${String(i)}`))}`,body=this.env.find(id);if(body===null)throw new Error(`Incompatible Imperial Bull rival ${id}`);this.rivals.push({a:body,lane,mode:bool(`rivalCharge${String(i)}`)?'charge':'approach'});});}
  }
  /** its lanes (a continuation saves each runner) */
  lanes(): readonly Lane<B>[] { return this.nativeLanes; }
  /** its streams (a continuation saves their states) */
  rngs(): readonly PineEliteStreams['fight'][] { return [this.streams.spawn, this.streams.fight]; }
  /** the fight: one engaged step of its admitted script (the row's lanes step first, then its verbs in order) */
  protected fight(a: B, dt: number, t: number): void {
    if(this.rule.rivals)this.tickRivals(dt,t);
    const { d, yaw } = this.toPlayer(a);
    stepEliteScript(this.script, { body: a, dt, t, mode: this.mode, modeT: this.modeT, p2: this.p2, d, yaw, player: this.env.player.position, god: this.env.god }, this.scriptPorts(a, dt, t));
  }
  /** the verbs' world: the shared voices, lanes and contacts, and this elite's own actions */
  protected scriptPorts(a: B, dt: number, t: number): EliteScriptPorts {
    const lane = (i: number): Lane<B> => { const l = this.lanes()[i]; if (l === undefined) throw new Error(`pine elite '${this.def.id}' has no lane ${String(i)}`); return l; };
    const p = this.env.player.position;
    return {
      setMode: (mode) => { this.setMode(mode); }, voice: (name) => { this.voice(name, a); }, signature: () => { this.sig(); },
      lane: (i) => this.lanes()[i] ?? null, stepLane: (i, trauma) => { lane(i).update(a, dt, t, p, (dmg) => { this.hurt(a, dmg); this.env.trauma(trauma); }); },
      startLane: (i, tell, speedMul) => { lane(i).start(a, p.x, p.z, tell, speedMul); },
      contact: (row) => {
        const spec = Object.values(PINE_STRIKES).find(s => s.id === row.strike);
        if (spec === undefined) throw new Error(`pine elite '${this.def.id}' names no strike ${row.strike}`);
        pineContact(a, p, spec, (damage) => { if (row.stun > 0) this.env.stun(row.stun); this.hurt(a, damage, row.throughWalls); this.env.trauma(row.trauma); }, () => this.env.reach(a, p));
      },
      trauma: (k) => { this.env.trauma(k); },
      ring:(radius,alpha)=>{this.ring?.ring(a.position.x,a.position.z,radius,alpha);},ringHide:()=>{this.ring?.hide();},
      ...(this.ring===null?{}:{ringTime:()=>{this.ring?.setTime(t);}}),
      ...(this.rule.rivals?{hostValues:():readonly[number,number]=>[this.rivals.length,bugleHour(this.env.dusk(),this.env.night())?1:0]}:{}),
      action: (name) => { this.act(name, a); },
    };
  }
  /** one of the elite's own actions its script names */
  protected act(name:string,a:B):void {
    if(!this.rule.actions.includes(name))throw new Error(`pine elite '${this.def.id}' has no action ${name}`);
    if(name==='fade')this.vanish(a);else if(name==='comeBack')this.comeBack(a);else if(name==='burstOut')this.burstOut(a);else if(name==='roarFx')this.env.fx.roar(a,this.p2?11:8);else if(name==='callRivals')this.callRivals(a);else throw new Error(`pine elite '${this.def.id}' has no action ${name}`);
  }
  private vanish(a: B): void {
    this.env.fx.fade(a);
    this.env.voice('deer_call', a);
    a.hidden = true; this.env.show(a, false); a.setMotion(a.yaw, 0, 1);
  }
  /** back behind you, 14–18 m off, on dry walkable ground inside its leash */
  comeBack(a: B): void {
    const p = this.env.player.position, L = this.def.lair;
    for (const side of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const q = behindPlayer(p.x, p.z, this.env.player.yaw, 14 + this.next() * 4, side);
      if (!this.env.inChunk(q.x, q.z, 24) || Math.hypot(q.x - L.x, q.z - L.z) > this.def.leashR - 12) continue;
      if (Math.abs(this.env.heightAt(q.x, q.z) - this.env.heightAt(p.x, p.z)) > 6) continue;
      this.reappear(a, q.x, q.z); return;
    }
    this.reappear(a, a.position.x, a.position.z);
  }
  private reappear(a: B, x: number, z: number): void {
    const p = this.env.player.position;
    a.place(x, z, headingTo(x, z, p.x, p.z));
    a.hidden = false; this.env.show(a, true);
    this.env.fx.reappear(a);
    this.setMode('stare');
  }
  private lurk(a: B): void {
    a.place(MOUTH.x, MOUTH.z, BEAR_CAVE.rot + Math.PI);
    a.hidden = true; this.env.show(a, false);
    this.setMode('lurk');
  }
  burstOut(a: B): void {
    const p = this.env.player.position;
    a.place(MOUTH.x - Math.sin(BEAR_CAVE.rot) * 2.5, MOUTH.z - Math.cos(BEAR_CAVE.rot) * 2.5, headingTo(MOUTH.x, MOUTH.z, p.x, p.z));
    a.hidden = false; this.env.show(a, true);
    this.env.fx.burstOut(a);
    this.sig();
  }
  private releaseRivals(): void { for (const r of this.rivals) { r.lane.cancel(); this.env.release(r.a); } this.rivals = []; }
  callRivals(a: B): void {
    const p = this.env.player.position, { yaw } = this.toPlayer(a);
    for (const [i, side] of [1, -1].entries()) {
      const ang = yaw + side * Math.PI / 2;
      let x = p.x + Math.sin(ang) * 55, z = p.z + Math.cos(ang) * 55;
      if (!this.env.inChunk(x, z, 24)) { x = p.x - Math.sin(ang) * 40; z = p.z - Math.cos(ang) * 40; }
      const r = this.env.spawn('elk', x, z, headingTo(x, z, p.x, p.z), i === 0 ? 'big-bull' : 'bull');
      this.env.own(r);
      const lane = this.nativeLanes[i+1];
      if (lane) this.rivals.push({ a: r, lane, mode: 'approach' });
      this.env.voice('elk_bugle', r);
    }
  }
  tickRivals(dt: number, t: number): void {
    const p = this.env.player.position;
    for (const r of this.rivals) {
      if (!r.a.alive) { r.lane.cancel(); continue; }
      const d = Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z);
      r.a.lookTarget.copy(p); r.a.lookWeight = 1;
      if (r.mode === 'charge') { r.lane.update(r.a, dt, t, p, (dmg) => { this.hurt(r.a, dmg); this.env.trauma(0.35); }); if (!r.lane.busy) r.mode = 'approach'; continue; }
      r.a.setMotion(headingTo(r.a.position.x, r.a.position.z, p.x, p.z), d > 16 ? 7 : 1.5, 2.5);
      if (d < 20 && this.next() < dt * 0.6) { r.lane.start(r.a, p.x, p.z, 0.9); r.mode = 'charge'; }
    }
    this.rivals = this.rivals.filter((r) => r.a.alive || r.lane.busy);
  }
}

/** The four native encounter owners in their original order. */
export function pineEliteScripts<B extends PineEliteBody>(env:PineEliteWorld<B>,seed?:number):[PineEliteScript<B>,PineEliteScript<B>,PineEliteScript<B>,PineEliteScript<B>] {
  return [new PineEliteScript('ironhide',env,seed),new PineEliteScript('ghost-stag',env,seed),new PineEliteScript('blackpaw',env,seed),new PineEliteScript('imperial-bull',env,seed)];
}
