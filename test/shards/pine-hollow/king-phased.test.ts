import { Vector3 } from 'three';
import { expect,it } from 'vitest';
import { AntlerKingCore,type KingBody,type KingCoreEnv } from '../../../src/shards/pine-hollow/combat/kingFight';
import { AntlerKingCore as OracleCore } from '../../fixtures/species-oracle/antlerKingFight';
import { Lane } from '../../../src/shards/pine-hollow/combat/lane';
import { PINE_LANES } from '../../../src/shards/pine-hollow/combat/strikes';
import { KINGS_CLEARING as C } from '../../../src/shards/pine-hollow/layout';

const KINGS_CLEARING=C;
/** A body the fight drives, renderer-free: it walks at its set motion when the test steps it. */
class Body implements KingBody {
  readonly position: Vector3; readonly lookTarget = new Vector3(); lookWeight = 0; readonly seed = 1; readonly lastHitT = -1; state = 'idle';
  alive = true; readonly scale = 1; yaw = 0; hp: number; readonly maxHp: number; herd = 0; speed = 0; attack=-1;
  constructor(readonly id: string, x: number, z: number, maxHp = 100) { this.position = new Vector3(x, 0, z); this.maxHp = maxHp; this.hp = maxHp; }
  startAttack(duration:number):void {this.attack=duration;}
  cancelAttack():void {this.attack=-1;}
  setMotion(yaw: number, speed: number): void { this.yaw = yaw; this.speed = speed; }
  place(x: number, z: number, yaw: number): void { this.position.set(x, 0, z); this.yaw = yaw; }
  move(dt: number): void { this.position.x += Math.sin(this.yaw) * this.speed * dt; this.position.z += Math.cos(this.yaw) * this.speed * dt; }
}

class NewHost extends AntlerKingCore<Body> {
  readonly bodies: Body[] = [];
  hurt=0;readonly events:unknown[]=[];
  private made = 0;
  protected override readonly ctx: KingCoreEnv<Body>;
  protected override readonly tellRing = {setTime:(t:number):void=>{this.events.push(['time',t]);},ring:(x:number,z:number,r:number,a:number):void=>{this.events.push(['tell',x,z,r,a]);},hide:():void=>{this.events.push(['hide']);}};
  protected override readonly waves = [0, 1].map(() => ({ r: 0, on: false, hit: false, delay: 0 }));
  protected override readonly lane = new Lane<Body>(PINE_LANES.king);
  protected override readonly thrallLanes = [0, 1, 2].map(() => new Lane<Body>(PINE_LANES.thrall));
  constructor(readonly player: Vector3, seed?: number) {
    super(seed);
    this.ctx = { reach: () => true, player: { position: player, get onGround():boolean {return player.y===0;}, shove:(x,z,speed)=>{this.events.push(['shove',x,z,speed]);} }, hurt: (_a, dmg) => { this.hurt += dmg;this.events.push(['hurt',_a.id,dmg]); },
      trauma:v=>{this.events.push(['trauma',v]);},shot:(name,at)=>{this.events.push(['shot',name,at.toArray()]);} };
  }
  protected override groundAt(): number { return 0; }
  protected override makeKing(): Body { return this.add(new Body(`king${String(this.made++)}`, KINGS_CLEARING.x, KINGS_CLEARING.z, 2000)); }
  protected override retireKing(k: Body): void { this.drop(k); }
  protected override parkKing(): void { /* stays in the list */ }
  protected override unparkKing(): void { /* stays in the list */ }
  readonly spawned: number[][] = [];
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): Body { this.spawned.push([x, z]); const a = this.add(new Body(`${kind}${String(this.made++)}`, x, z, 40)); a.yaw = yaw; return a; }
  protected override retireThrall(a: Body): void { this.drop(a); }
  protected override action(a:Body,move:string):void {this.events.push(['action',a.id,move]);}
  protected override roar(a:Body):void {this.events.push(['roar',a.id]);}
  protected override onRibs(p:Vector3):boolean {return this.king!==null && p.distanceTo(this.king.position)<0.7;}
  protected override glowTo(v:number):void {this.events.push(['glow',v]);}
  protected override lanternsHung(on:boolean):void {this.events.push(['hung',on]);}
  protected override room(dt:number,t:number):void {this.events.push(['room',dt,t,this.sealK,this.darkK,this.open]);}
  protected override lightOn():void {this.events.push(['light',true]);}
  protected override lightOff():void {this.events.push(['light',false]);}
  protected override waveView(i:number,t:number,at:Vector3|null):void {this.events.push(['wave',i,t,at?.toArray()??null]);}
  protected override thrallView(a:Body,event:string):void {this.events.push(['add',a.id,event]);}
  protected override lanternView(i:number,f:{x:number;y:number;z:number;fallT:number;acc:number},t:number,event:string):void {this.events.push(['hazard',i,{...f},t,event]);}
  protected override stompFx(a:Body):void {this.events.push(['burst',a.id]);}
  private add(b: Body): Body { this.bodies.push(b); return b; }
  private drop(b: Body): void { const i = this.bodies.indexOf(b); if (i !== -1) this.bodies.splice(i, 1); }
  find(id: string): Body | null { return this.bodies.find(b => b.id === id) ?? null; }

  cloneBodies(from:readonly Body[]):void {this.made=Math.max(this.made,...from.map(b=>Number(b.id.replaceAll(/\D+/gu,''))+1));for(const b of from){const copy=Object.assign(new Body(b.id,b.position.x,b.position.z,b.maxHp),{hp:b.hp,yaw:b.yaw,speed:b.speed,alive:b.alive,attack:b.attack,herd:b.herd});copy.position.copy(b.position);copy.lookTarget.copy(b.lookTarget);copy.lookWeight=b.lookWeight;this.bodies.push(copy);}}
  step(dt: number, t: number,fighting=true): void { this.update(dt, t, fighting); for (const b of this.bodies) b.move(dt); }
}

class OracleHost extends OracleCore<Body> {
  readonly bodies: Body[] = [];
  hurt=0;readonly events:unknown[]=[];
  private made = 0;
  protected override readonly ctx: KingCoreEnv<Body>;
  protected override readonly tellRing = {setTime:(t:number):void=>{this.events.push(['time',t]);},ring:(x:number,z:number,r:number,a:number):void=>{this.events.push(['tell',x,z,r,a]);},hide:():void=>{this.events.push(['hide']);}};
  protected override readonly waves = [0, 1].map(() => ({ r: 0, on: false, hit: false, delay: 0 }));
  protected override readonly lane = new Lane<Body>(PINE_LANES.king);
  protected override readonly thrallLanes = [0, 1, 2].map(() => new Lane<Body>(PINE_LANES.thrall));
  constructor(readonly player: Vector3, seed?: number) {
    super(seed);
    this.ctx = { reach: () => true, player: { position: player, get onGround():boolean {return player.y===0;}, shove:(x,z,speed)=>{this.events.push(['shove',x,z,speed]);} }, hurt: (_a, dmg) => { this.hurt += dmg;this.events.push(['hurt',_a.id,dmg]); },
      trauma:v=>{this.events.push(['trauma',v]);},shot:(name,at)=>{this.events.push(['shot',name,at.toArray()]);} };
  }
  protected override groundAt(): number { return 0; }
  protected override makeKing(): Body { return this.add(new Body(`king${String(this.made++)}`, KINGS_CLEARING.x, KINGS_CLEARING.z, 2000)); }
  protected override retireKing(k: Body): void { this.drop(k); }
  protected override parkKing(): void { /* stays in the list */ }
  protected override unparkKing(): void { /* stays in the list */ }
  readonly spawned: number[][] = [];
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): Body { this.spawned.push([x, z]); const a = this.add(new Body(`${kind}${String(this.made++)}`, x, z, 40)); a.yaw = yaw; return a; }
  protected override retireThrall(a: Body): void { this.drop(a); }
  protected override action(a:Body,move:string):void {this.events.push(['action',a.id,move]);}
  protected override roar(a:Body):void {this.events.push(['roar',a.id]);}
  protected override onRibs(p:Vector3):boolean {return this.king!==null && p.distanceTo(this.king.position)<0.7;}
  protected override glowTo(v:number):void {this.events.push(['glow',v]);}
  protected override lanternsHung(on:boolean):void {this.events.push(['hung',on]);}
  protected override room(dt:number,t:number):void {this.events.push(['room',dt,t,this.sealK,this.darkK,this.open]);}
  protected override lightOn():void {this.events.push(['light',true]);}
  protected override lightOff():void {this.events.push(['light',false]);}
  protected override waveView(i:number,t:number,at:Vector3|null):void {this.events.push(['wave',i,t,at?.toArray()??null]);}
  protected override thrallView(a:Body,event:string):void {this.events.push(['add',a.id,event]);}
  protected override lanternView(i:number,f:{x:number;y:number;z:number;fallT:number;acc:number},t:number,event:string):void {this.events.push(['hazard',i,{...f},t,event]);}
  protected override stompFx(a:Body):void {this.events.push(['burst',a.id]);}
  private add(b: Body): Body { this.bodies.push(b); return b; }
  private drop(b: Body): void { const i = this.bodies.indexOf(b); if (i !== -1) this.bodies.splice(i, 1); }
  find(id: string): Body | null { return this.bodies.find(b => b.id === id) ?? null; }

  cloneBodies(from:readonly Body[]):void {this.made=Math.max(this.made,...from.map(b=>Number(b.id.replaceAll(/\D+/gu,''))+1));for(const b of from){const copy=Object.assign(new Body(b.id,b.position.x,b.position.z,b.maxHp),{hp:b.hp,yaw:b.yaw,speed:b.speed,alive:b.alive,attack:b.attack,herd:b.herd});copy.position.copy(b.position);copy.lookTarget.copy(b.lookTarget);copy.lookWeight=b.lookWeight;this.bodies.push(copy);}}
  step(dt: number, t: number,fighting=true): void { this.update(dt, t, fighting); for (const b of this.bodies) b.move(dt); }
}

function observed(host:NewHost|OracleHost,offset=0):string {
  const value=JSON.stringify({fight:host.fightState(a=>a.id),bodies:host.bodies.map(a=>({id:a.id,p:a.position.toArray(),yaw:a.yaw,hp:a.hp,alive:a.alive,herd:a.herd,speed:a.speed,attack:a.attack,look:a.lookTarget.toArray(),weight:a.lookWeight})),hurt:host.hurt-offset,events:host.events});
  host.events.length=0;return value;
}
it('matches the frozen shipping fight every tick across all phases, strikes, hazards, adds, lane chains and lifecycle edges',()=>{
  const a=new NewHost(new Vector3(C.x,0,C.z+9)),b=new OracleHost(new Vector3(C.x,0,C.z+9));
  expect(a.intro(0,false).toArray()).toEqual(b.intro(0,false).toArray());
  expect(a.rewardPoint().toArray()).toEqual(b.rewardPoint().toArray());
  expect(a.respawnPoint()).toEqual(b.respawnPoint());
  const modes=new Set<string>(),lanes=new Set<string>();
  for(const h of [a,b]){h.setPresent(true);h.reset(0);h.seal(true);}
  expect(observed(a)).toBe(observed(b));
  for(let frame=0;frame<14000;frame++){
    const t=frame/60;
    for(const h of [a,b]) {
      const phase=frame<4500?0:frame<9000?1:2;
      const radius=frame%600<180?5:frame%600<360?12:frame%600<500?21:33;
      const angle=frame/137;
      h.player.set(C.x+Math.sin(angle)*radius,frame%250<25?0.8:0,C.z+Math.cos(angle)*radius);
      if(frame<260)h.intro(t,frame>170);
      if(frame===260)h.begin(0);
      if(frame===4500 || frame===9000)h.enterPhase(phase);
      if(frame===4550 || frame===9050)h.begin(phase);
      if(frame===4800 || frame===9800){h.setInvulnerable(true);h.clampHp(0.3);}
      if(frame===4840 || frame===9840)h.setInvulnerable(false);
      if(h.king && frame%19===0) {
        const point=h.king.position.clone().add(new Vector3(frame%38===0?0:1,0,0));
        h.events.push(['damage',h.damageMul(h.king,point)]);h.king.hp-=3;
      }
      if(frame%900===899) {const add=h.bodies.find(x=>x!==h.king&&x.alive);if(add)add.alive=false;}
      if(frame===13500)h.victory();
      if(frame===13700)h.setPresent(false);
      if(frame===13730){h.setPresent(true);h.reset(2);h.seal(false);h.begin(2);}
      h.step(1/60,t,(frame>=260 && frame<13500) || frame>=13730);
    }
    const state=a.fightState(x=>x.id);modes.add(state.mode);lanes.add(state.lane.runner.phase);
    expect(observed(a),`tick ${String(frame)}`).toBe(observed(b));
  }
  expect([...modes]).toEqual(expect.arrayContaining(['intro','stalk','sweep','stomp','waves','open','call','stalk3','dead','dormant']));
  expect([...lanes]).toEqual(expect.arrayContaining(['windup','active','recover','idle']));
});
it('restores the frozen continuation during summons, falling hazards, rings and lane recovery without a timing or RNG gap',()=>{
  for(const phase of [1,2]){
    const a=new NewHost(new Vector3(C.x,0,C.z+9)),b=new OracleHost(new Vector3(C.x,0,C.z+9));
    for(const h of [a,b]){h.setPresent(true);h.reset(phase);h.seal(true);h.begin(phase);}
    for(let tick=0;tick<950;tick++) {a.step(1/60,tick/60);b.step(1/60,tick/60);expect(observed(a)).toBe(observed(b));}
    const c=new NewHost(a.player.clone());c.cloneBodies(a.bodies);c.restoreFight(b.fightState(x=>x.id),id=>c.find(id));
    expect(c.fightState(x=>x.id)).toEqual(b.fightState(x=>x.id));
    c.events.length=0;a.events.length=0;
    const before=a.hurt;
    for(let tick=950;tick<1800;tick++) {
      a.step(1/60,tick/60);c.step(1/60,tick/60);
      expect(observed(a,before)).toBe(observed(c));
    }
  }
});
