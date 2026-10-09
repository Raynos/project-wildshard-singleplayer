import * as THREE from 'three';
import type { AnimalPoseRecipe,AnimalPoseInput } from '../../../src/engine/entities/animalPose';

// pose parameter indices
const P_BODY_Y = 0, P_BODY_PITCH = 1, P_BODY_ROLL = 2;
const P_NECK1 = 4, P_NECK2 = 5, P_HEAD_P = 6, P_HEAD_Y = 7, P_NECK_Y = 8;
const P_EARL_P = 9, P_EARL_Y = 10, P_EARR_P = 11, P_EARR_Y = 12;
const P_TAIL_P = 13, P_TAIL_Y = 14;
const P_LEG = 15; // + leg*3 (0 upper, 1 mid, 2 lower)   legs: 0 FL, 1 FR, 2 BL, 3 BR
const P_COUNT = 27;

const G_IDLE = 0, G_GRAZE = 1, G_WALK = 2, G_TROT = 3, G_GALLOP = 4;

interface GaitDef { offsets: [number, number, number, number]; stance: number; amp: number; lift: number; bob: number; pitch: number }
type MovingGait = typeof G_WALK | typeof G_TROT | typeof G_GALLOP;
const MOVING_GAITS: readonly MovingGait[] = [G_WALK, G_TROT, G_GALLOP];
const GAITS: Record<MovingGait, GaitDef> = {
  [G_WALK]: { offsets: [0.25, 0.75, 0.0, 0.5], stance: 0.62, amp: 0.36, lift: 0.9, bob: 0.012, pitch: 0.01 },
  [G_TROT]: { offsets: [0.0, 0.5, 0.5, 0.0], stance: 0.48, amp: 0.45, lift: 1.1, bob: 0.03, pitch: 0.02 },
  [G_GALLOP]: { offsets: [0.55, 0.68, 0.0, 0.12], stance: 0.36, amp: 0.66, lift: 1.5, bob: 0.06, pitch: 0.09 },
};

const smooth01 = (t: number) => t * t * (3 - 2 * t);
const pulse = (t: number, period: number, seed: number, width = 0.12) => {
  // a short unit bump once per `period` seconds at a seeded phase
  const p = ((t + seed * 7.13) / period) % 1;
  return p < width ? Math.sin((p / width) * Math.PI) : 0;
};

const _v=new THREE.Vector3(), PRESENT={};
export class ShippingAnimalPoseOracle {
  readonly input: AnimalPoseInput = {
    speed:0,strafe:0,scale:1,seed:0,state:'idle',alive:true,position:{x:0,y:0,z:0},lookTarget:{x:0,y:0,z:0},
    yaw:0,lookWeight:0,flinch:0,flinchRoll:0,flinchPitch:0,brace:0,stunT:0,deathT:-1,deathSide:1,
    attackT:-1,attackDur:1,groundY:0,tiltRollT:0,levelGround:false,flying:false,advanceAttack:true,desiredSpeed:0,debugGait:undefined,
  };
  readonly pose=new Float32Array(P_COUNT);
  readonly tmp=new Float32Array(P_COUNT);
  readonly gaitW=new Float32Array(5);
  readonly gaitTarget=new Float32Array(5);
  readonly lastFootPhase=new Float32Array(4);
  phase=0;lookAmt=0;tiltPitch=0;tiltRoll=0;tiltPitchT=0;
  readonly footDelta=new Float32Array(4);
  readonly footDeltaT=new Float32Array(4);
  poseFrozen=false;
  onFootfall: ((owner:unknown,strength:number)=>void)|undefined;
  
  private readonly model:{dims:AnimalPoseRecipe['dims'];species:{pose:AnimalPoseRecipe['pose']}};
  private readonly custom:boolean;
  private readonly gaitTrot:number; private readonly gaitGallop:number;
  private get externalSimulation():null|object{return this.input.advanceAttack?null:PRESENT;}
  private get flight():null|object{return this.input.flying?PRESENT:null;}
  private get attackPhase():number{return this.input.attackT<0?-1:Math.min(1,this.input.attackT/this.input.attackDur);}
  private get speed():AnimalPoseInput['speed'] {return this.input.speed;}
  private set speed(value:AnimalPoseInput['speed']) {this.input.speed=value;}
  private get strafe():AnimalPoseInput['strafe'] {return this.input.strafe;}
  private set strafe(value:AnimalPoseInput['strafe']) {this.input.strafe=value;}
  private get scale():AnimalPoseInput['scale'] {return this.input.scale;}
  private set scale(value:AnimalPoseInput['scale']) {this.input.scale=value;}
  private get seed():AnimalPoseInput['seed'] {return this.input.seed;}
  private set seed(value:AnimalPoseInput['seed']) {this.input.seed=value;}
  private get state():AnimalPoseInput['state'] {return this.input.state;}
  private set state(value:AnimalPoseInput['state']) {this.input.state=value;}
  private get alive():AnimalPoseInput['alive'] {return this.input.alive;}
  private set alive(value:AnimalPoseInput['alive']) {this.input.alive=value;}
  private get position():AnimalPoseInput['position'] {return this.input.position;}
  private set position(value:AnimalPoseInput['position']) {this.input.position=value;}
  private get lookTarget():AnimalPoseInput['lookTarget'] {return this.input.lookTarget;}
  private set lookTarget(value:AnimalPoseInput['lookTarget']) {this.input.lookTarget=value;}
  private get yaw():AnimalPoseInput['yaw'] {return this.input.yaw;}
  private set yaw(value:AnimalPoseInput['yaw']) {this.input.yaw=value;}
  private get lookWeight():AnimalPoseInput['lookWeight'] {return this.input.lookWeight;}
  private set lookWeight(value:AnimalPoseInput['lookWeight']) {this.input.lookWeight=value;}
  private get flinchRoll():AnimalPoseInput['flinchRoll'] {return this.input.flinchRoll;}
  private set flinchRoll(value:AnimalPoseInput['flinchRoll']) {this.input.flinchRoll=value;}
  private get flinchPitch():AnimalPoseInput['flinchPitch'] {return this.input.flinchPitch;}
  private set flinchPitch(value:AnimalPoseInput['flinchPitch']) {this.input.flinchPitch=value;}
  private get flinch():AnimalPoseInput['flinch'] {return this.input.flinch;}
  private set flinch(value:AnimalPoseInput['flinch']) {this.input.flinch=value;}
  private get brace():AnimalPoseInput['brace'] {return this.input.brace;}
  private set brace(value:AnimalPoseInput['brace']) {this.input.brace=value;}
  private get stunT():AnimalPoseInput['stunT'] {return this.input.stunT;}
  private set stunT(value:AnimalPoseInput['stunT']) {this.input.stunT=value;}
  private get deathT():AnimalPoseInput['deathT'] {return this.input.deathT;}
  private set deathT(value:AnimalPoseInput['deathT']) {this.input.deathT=value;}
  private get deathSide():AnimalPoseInput['deathSide'] {return this.input.deathSide;}
  private set deathSide(value:AnimalPoseInput['deathSide']) {this.input.deathSide=value;}
  private get attackT():AnimalPoseInput['attackT'] {return this.input.attackT;}
  private set attackT(value:AnimalPoseInput['attackT']) {this.input.attackT=value;}
  private get groundY():AnimalPoseInput['groundY'] {return this.input.groundY;}
  private set groundY(value:AnimalPoseInput['groundY']) {this.input.groundY=value;}
  private get tiltRollT():AnimalPoseInput['tiltRollT'] {return this.input.tiltRollT;}
  private set tiltRollT(value:AnimalPoseInput['tiltRollT']) {this.input.tiltRollT=value;}
  private get levelGround():AnimalPoseInput['levelGround'] {return this.input.levelGround;}
  private set levelGround(value:AnimalPoseInput['levelGround']) {this.input.levelGround=value;}
  private get desiredSpeed():AnimalPoseInput['desiredSpeed'] {return this.input.desiredSpeed;}
  private set desiredSpeed(value:AnimalPoseInput['desiredSpeed']) {this.input.desiredSpeed=value;}
  private get debugGait():AnimalPoseInput['debugGait'] {return this.input.debugGait;}
  private set debugGait(value:AnimalPoseInput['debugGait']) {this.input.debugGait=value;}
  constructor(recipe:AnimalPoseRecipe){this.model={dims:recipe.dims,species:{pose:recipe.pose}};this.custom=recipe.custom;this.gaitTrot=recipe.gait?.trot??2.4;this.gaitGallop=recipe.gait?.gallop??4.6;this.gaitW[G_IDLE]=1;}
  advance(dt:number,t:number,near:boolean):void{
    this.poseFrozen=false;const d=this.model.dims;
    // gait weights from speed
    const gw = this.gaitTarget;
    gw.fill(0);
    const s = Math.hypot(this.speed, this.strafe) / this.scale;
    if (this.debugGait) {
      const gi = ['idle', 'graze', 'walk', 'trot', 'gallop'].indexOf(this.debugGait.gait);
      this.gaitW.fill(0); this.gaitW[Math.max(0, gi)] = 1; this.phase = this.debugGait.phase;
      if (this.externalSimulation === null) { this.speed = 0; this.desiredSpeed = 0; }
      gw.set(this.gaitW);
    } else if (!this.alive) { gw[G_IDLE] = 1; }
    else if (s < 0.15) { if (this.state === 'graze') gw[G_GRAZE] = 1; else gw[G_IDLE] = 1; }
    else if (s < this.gaitTrot) { const k = THREE.MathUtils.clamp((s - 0.15) / 0.6, 0, 1); gw[G_WALK] = k; gw[this.state === 'graze' ? G_GRAZE : G_IDLE] = 1 - k; }
    else if (s < this.gaitGallop) { const k = THREE.MathUtils.clamp((s - this.gaitTrot) / (this.gaitTrot * 0.5), 0, 1); gw[G_TROT] = k; gw[G_WALK] = 1 - k; }
    else { const k = THREE.MathUtils.clamp((s - this.gaitGallop) / (this.gaitGallop * 0.3), 0, 1); gw[G_GALLOP] = k; gw[G_TROT] = 1 - k; }
    const bl = Math.min(1, dt * 6);
    const W = this.gaitW;
    let wsum = 0;
    for (let i = 0; i < 5; i++) { W[i] = (W[i] ?? 0) + ((gw[i] ?? 0) - (W[i] ?? 0)) * bl; wsum += W[i] ?? 0; }
    for (let i = 0; i < 5; i++) W[i] = (W[i] ?? 0) / wsum;

    // gait phase: stride frequency from speed so hooves don't slide
    const wWalk = W[G_WALK] ?? 0, wTrot = W[G_TROT] ?? 0, wGallop = W[G_GALLOP] ?? 0;
    const moving = wWalk + wTrot + wGallop;
    if (moving > 0.01 && this.alive && !this.debugGait) {
      const g = wGallop > 0.5 ? GAITS[G_GALLOP] : wTrot > 0.5 ? GAITS[G_TROT] : GAITS[G_WALK];
      const stride = 2 * d.legLen * Math.sin(g.amp) * this.scale * (g === GAITS[G_GALLOP] ? 1.9 : g === GAITS[G_TROT] ? 1.35 : 1.0);
      const freq = Math.max(0.6, Math.hypot(this.speed, this.strafe) * g.stance / stride);
      this.phase = (this.phase + freq * dt) % 1;
    }
    if (this.externalSimulation === null && this.attackT >= 0) this.attackT += dt;

    if (!near) {
      if (this.flight !== null) this.easeTilt(Math.min(1,dt*5));
      this.poseFrozen=true;return;
    }
    if (this.custom) {
      // a custom rig: advance the shared timers, then the species poses its own bones
      if (this.flinch > 0.001) this.flinch *= Math.exp(-dt * 5.5);
      if (this.brace > 0.001 && this.stunT <= 0) this.brace *= Math.exp(-dt * 7);
      if (this.deathT >= 0) this.deathT = Math.min(1, this.deathT + dt / 0.8);
      this.lookAmt += ((this.alive ? this.lookWeight : 0) - this.lookAmt) * Math.min(1, dt * 4);
      this.applyTerrain(dt);
      return;
    }
    const pose = this.pose;
    pose.fill(0);
    const seed = this.seed;
    // ── blended base layers ──
    const wIdle = W[G_IDLE] ?? 0, wGraze = W[G_GRAZE] ?? 0;
    if (wIdle > 0.001) { this.poseIdle(t, seed); this.accumulate(wIdle); }
    if (wGraze > 0.001) { this.poseGraze(t, seed); this.accumulate(wGraze); }
    for (const g of MOVING_GAITS) { const w = W[g] ?? 0; if (w > 0.001) { this.poseGait(GAITS[g], t, seed); this.accumulate(w); } }

    // ── alert look-at (additive) ──
    const lookTarget = this.alive ? this.lookWeight : 0;
    this.lookAmt += (lookTarget - this.lookAmt) * Math.min(1, dt * 4);
    if (this.lookAmt > 0.001) {
      _v.subVectors(this.lookTarget, this.position);
      let ly = Math.atan2(_v.x, _v.z) - this.yaw;
      ly = Math.atan2(Math.sin(ly), Math.cos(ly));
      ly = THREE.MathUtils.clamp(ly, -1.2, 1.2);
      const dist = Math.hypot(_v.x, _v.z);
      const lp = THREE.MathUtils.clamp(-Math.atan2(_v.y - d.bodyY * 1.6, dist), -0.5, 0.5);
      this.add(P_NECK_Y, ly * 0.55 * this.lookAmt);
      this.add(P_HEAD_Y, ly * 0.45 * this.lookAmt);
      this.add(P_HEAD_P, lp * this.lookAmt);
      // head up (lifts out of a graze), ears pricked forward, neck raised
      this.blendTo(P_NECK1, -0.15, this.lookAmt); this.blendTo(P_NECK2, -0.05, this.lookAmt);
      this.add(P_HEAD_P, (0.12 - (pose[P_HEAD_P] ?? 0)) * this.lookAmt * 0.8);
      this.add(P_EARL_P, -0.35 * this.lookAmt); this.add(P_EARR_P, -0.35 * this.lookAmt);
      this.add(P_EARL_Y, 0.25 * this.lookAmt); this.add(P_EARR_Y, -0.25 * this.lookAmt);
    }

    // ── hit flinch (additive, decays) ──
    if (this.flinch > 0.001) {
      const f = this.flinch;
      this.add(P_BODY_ROLL, this.flinchRoll * f);
      this.add(P_BODY_PITCH, this.flinchPitch * f);
      this.add(P_BODY_Y, -0.06 * f * d.bodyY);
      this.add(P_HEAD_P, 0.35 * f); this.add(P_NECK1, -0.2 * f);
      this.add(P_EARL_P, 0.5 * f); this.add(P_EARR_P, 0.5 * f);
      this.add(P_TAIL_P, -0.6 * f);
      this.flinch *= Math.exp(-dt * 5.5);
    }
    // ── stagger brace (held for the stun, then released): hunkered low, nose down, ears pinned, tail clamped ──
    if (this.brace > 0.001) {
      const b = smooth01(this.brace);
      this.add(P_BODY_Y, -0.14 * b * d.bodyY);
      this.add(P_BODY_PITCH, 0.06 * b);
      this.add(P_NECK1, 0.28 * b); this.add(P_NECK2, 0.12 * b); this.add(P_HEAD_P, 0.25 * b);
      this.add(P_EARL_P, 0.6 * b); this.add(P_EARR_P, 0.6 * b);
      this.add(P_TAIL_P, -0.7 * b);
      for (let l = 0; l < 4; l++) this.add(P_LEG + l * 3 + 1, 0.16 * b);   // knees bent: legs take the shove
      if (this.stunT <= 0) this.brace *= Math.exp(-dt * 7);
    }

    // ── attack wind-up (the manager's charge telegraph on a melee shard): head down, front low, a front hoof paws ──
    if (this.alive && this.attackT >= 0) this.poseWindup(t);

    // ── death collapse ──
    if (this.deathT >= 0) {
      this.deathT = Math.min(1, this.deathT + dt / 0.8);
      const k = smooth01(this.deathT);
      const side = this.deathSide;
      // legs buckle first, then the body rolls onto its side
      const buckle = smooth01(Math.min(1, this.deathT * 1.8));
      const roll = smooth01(Math.max(0, (this.deathT - 0.25) / 0.75));
      const restY = d.halfWidth * 0.95 - d.bodyY;                 // body bone height when lying on its side
      this.blendTo(P_BODY_Y, restY, k);
      this.blendTo(P_BODY_ROLL, side * (Math.PI / 2 - 0.12), roll);
      this.blendTo(P_BODY_PITCH, 0.05, k);
      this.blendTo(P_NECK1, 0.55 - 0.25 * buckle, k); this.blendTo(P_NECK2, 0.35, k);
      this.blendTo(P_HEAD_P, 0.45, k); this.blendTo(P_HEAD_Y, side * 0.25, k); this.blendTo(P_NECK_Y, side * 0.2, k);
      this.blendTo(P_EARL_P, 0.6, k); this.blendTo(P_EARR_P, 0.6, k); this.blendTo(P_EARL_Y, 0, k); this.blendTo(P_EARR_Y, 0, k);
      this.blendTo(P_TAIL_P, 0.3, k); this.blendTo(P_TAIL_Y, 0, k);
      for (let l = 0; l < 4; l++) {
        const front = l < 2, down = (l % 2 === 0) === (side < 0); // legs on the ground side tuck, top legs drape
        this.blendTo(P_LEG + l * 3, (front ? -0.45 : 0.3) * (down ? 1 : 0.6) + 0.2 * buckle, k);
        this.blendTo(P_LEG + l * 3 + 1, (front ? 0.55 : 0.5) * (down ? 1 : 0.7) * buckle, k);
        this.blendTo(P_LEG + l * 3 + 2, (front ? 0.2 : -0.3) * buckle, k);
      }
    }

    this.applyTerrain(dt);
  }
  /** the charge telegraph, additive on the pose: eased in over the first 30 % of the attack, held, eased out in the last 15 % */
  private poseWindup(t: number): void {
    const ph = this.attackPhase;
    const env = smooth01(Math.min(1, ph / 0.3)) * smooth01(Math.min(1, (1 - ph) / 0.15));
    if (env <= 0.001) return;
    this.add(P_BODY_PITCH, 0.1 * env);                       // nose down, rump up
    this.add(P_BODY_Y, -0.05 * env * this.model.dims.bodyY);
    this.add(P_NECK1, 0.45 * env); this.add(P_NECK2, 0.15 * env); this.add(P_HEAD_P, 0.25 * env);
    this.add(P_EARL_P, 0.55 * env); this.add(P_EARR_P, 0.55 * env);  // ears pinned
    this.add(P_TAIL_P, 0.6 * env);                          // tail up
    const paw = Math.max(0, Math.sin(t * 13 + this.seed * 5));        // the front-right hoof scrapes back, twice a second
    this.add(P_LEG + 1 * 3, (-0.35 + 0.7 * paw) * env); this.add(P_LEG + 1 * 3 + 1, 0.45 * paw * env);
    this.add(P_LEG + 2 * 3 + 1, 0.12 * env); this.add(P_LEG + 3 * 3 + 1, 0.12 * env);  // hind legs load
  }

  // ── pose generators (write into this.tmp) ────────────────────────────────────────────

  private accumulate(w: number): void { const p = this.pose, t = this.tmp; for (let i = 0; i < P_COUNT; i++) p[i] = (p[i] ?? 0) + (t[i] ?? 0) * w; }
  private add(i: number, v: number): void { this.pose[i] = (this.pose[i] ?? 0) + v; }
  private blendTo(i: number, v: number, k: number): void { const cur = this.pose[i] ?? 0; this.pose[i] = cur + (v - cur) * k; }

  private poseIdle(t: number, seed: number): void {
    const p = this.tmp; p.fill(0);
    const br = Math.sin(t * 1.5 + seed * 3);                        // breathing
    p[P_BODY_Y] = 0.006 * br;
    p[P_BODY_PITCH] = 0.004 * br;
    // slow, wandering head + neck (perlin-ish from summed sines)
    const hy = Math.sin(t * 0.37 + seed) * 0.5 + Math.sin(t * 0.91 + seed * 2.3) * 0.3;
    p[P_NECK_Y] = hy * 0.25; p[P_HEAD_Y] = hy * 0.2;
    p[P_NECK1] = 0.02 * Math.sin(t * 0.53 + seed * 1.7) + 0.05;
    p[P_HEAD_P] = 0.1 + 0.06 * Math.sin(t * 0.71 + seed);
    // ear flicks
    const fl = pulse(t, 4.3, seed), fr = pulse(t, 5.7, seed + 0.5);
    p[P_EARL_Y] = 0.15 + fl * 0.6; p[P_EARR_Y] = -0.15 - fr * 0.6;
    p[P_EARL_P] = fl * 0.3 + 0.05 * Math.sin(t * 1.3 + seed); p[P_EARR_P] = fr * 0.3 + 0.05 * Math.cos(t * 1.1 + seed);
    // tail swish
    const sw = 0.5 + 0.5 * Math.sin(t * 0.29 + seed * 4);
    p[P_TAIL_Y] = Math.sin(t * 3.1 + seed) * 0.45 * sw; p[P_TAIL_P] = 0.08 * Math.sin(t * 1.9);
    // relaxed stance: one hind leg slightly cocked
    const cock = ((seed * 10) | 0) % 2 === 0 ? 2 : 3;
    p[P_LEG + cock * 3 + 1] = 0.12; p[P_LEG + cock * 3] = 0.06;
    p[P_LEG + 0 * 3] = 0.03; p[P_LEG + 1 * 3] = -0.03;
  }

  private poseGraze(t: number, seed: number): void {
    this.poseIdle(t, seed);
    const p = this.tmp;
    const gn = this.model.species.pose?.grazeNeck ?? 1;   // a species sets its own (SpeciesDef.pose: the kit boar's 0.3)
    // head to the ground; deer (grazeNeck 1) need the whole neck down, boars (0.3) only nose down a little
    p[P_NECK1] = 0.35 + 0.85 * gn; p[P_NECK2] = 0.2 + 0.75 * gn; p[P_HEAD_P] = 0.35 + 0.35 * gn;
    p[P_NECK_Y] = (p[P_NECK_Y] ?? 0) * 0.6; p[P_HEAD_Y] = (p[P_HEAD_Y] ?? 0) * 0.4;
    // nibbling
    const nib = Math.sin(t * 6 + seed) * 0.5 + 0.5;
    p[P_HEAD_P] += 0.05 * nib; p[P_HEAD_Y] += 0.08 * Math.sin(t * 2.2 + seed);
    // front legs a touch spread / one forward
    p[P_LEG + 0] = 0.1; p[P_LEG + 3] = -0.06;
    p[P_EARL_Y] = 0.5 + 0.3 * pulse(t, 3.1, seed); p[P_EARR_Y] = -0.5 - 0.3 * pulse(t, 4.4, seed + 0.3);
  }

  private poseGait(g: GaitDef, t: number, seed: number): void {
    const p = this.tmp; p.fill(0);
    const ph = this.phase;
    const gallop = g === GAITS[G_GALLOP], trot = g === GAITS[G_TROT];
    for (let l = 0; l < 4; l++) {
      const lp = (ph + (g.offsets[l] ?? 0)) % 1;
      const front = l < 2;
      let upper: number, mid: number, lower: number;
      if (lp < g.stance) {
        const u = lp / g.stance;
        upper = g.amp * (1 - 2 * u);                                 // foot on the ground sweeping back
        mid = 0.12 * g.lift * Math.sin(u * Math.PI) * 0.35;
        lower = 0.1 * Math.sin(u * Math.PI);
        if (u < 0.08 && (this.lastFootPhase[l] ?? 0) > 0.5) this.onFootfall?.(this, gallop ? 1 : trot ? 0.6 : 0.35);
        this.lastFootPhase[l] = 0;
      } else {
        const v = (lp - g.stance) / (1 - g.stance);
        upper = -g.amp + 2 * g.amp * smooth01(v);                    // swing forward
        const lift = Math.sin(v * Math.PI) * g.lift;
        mid = lift * (front ? 0.7 : 0.5);
        lower = lift * (front ? 0.3 : -0.35);
        this.lastFootPhase[l] = v;
      }
      // hind legs: hip drives the thigh; stifle/hock fold
      const amp = front ? 1 : 0.85;
      p[P_LEG + l * 3] = upper * amp;
      p[P_LEG + l * 3 + 1] = front ? mid : mid * 0.9;
      p[P_LEG + l * 3 + 2] = lower;
    }
    const beat = gallop ? Math.sin(ph * Math.PI * 2 + 0.6) : Math.sin(ph * Math.PI * 4);
    p[P_BODY_Y] = g.bob * beat;
    p[P_BODY_PITCH] = g.pitch * (gallop ? Math.sin(ph * Math.PI * 2 - 0.3) : beat) * (gallop ? 1 : 0.5);
    // neck counter-motion + head held forward when running
    p[P_NECK1] = (gallop ? 0.25 : trot ? 0.15 : 0.06) - beat * (gallop ? 0.12 : 0.03);
    p[P_NECK2] = gallop ? 0.1 : 0.03;
    p[P_HEAD_P] = (gallop ? -0.05 : 0.15) + beat * (gallop ? 0.08 : 0.02);
    p[P_HEAD_Y] = Math.sin(t * 0.7 + seed) * 0.08;
    // ears back at speed, tail up when fleeing
    p[P_EARL_P] = gallop ? 0.7 : 0.1; p[P_EARR_P] = gallop ? 0.7 : 0.1;
    p[P_EARL_Y] = 0.2; p[P_EARR_Y] = -0.2;
    p[P_TAIL_P] = gallop ? (this.model.species.pose?.gallopTail ?? 1.0) : 0.1 + 0.15 * beat;   // + = raised
    p[P_TAIL_Y] = Math.sin(ph * Math.PI * 2) * 0.15;
  }

  /** Sample the slope under the body (called by the manager at 10 Hz — heightAt is not free). */
  sampleTerrain(heightAt:(x:number,z:number)=>number): void {
    if (this.levelGround) { this.tiltPitchT = 0; this.tiltRollT = 0; this.footDeltaT.fill(0); return; }
    // a live flier's body follows its own turn (update), not the slope of the ground far below it
    if (this.flight !== null && this.alive) { this.tiltPitchT = 0; this.footDeltaT.fill(0); return; }
    const d = this.model.dims;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const L = d.bodyHalfLen * 0.9 * this.scale, W = d.halfWidth * this.scale;
    const hf = heightAt(this.position.x + sin * L, this.position.z + cos * L);
    const hb = heightAt(this.position.x - sin * L, this.position.z - cos * L);
    const hl = heightAt(this.position.x + cos * W, this.position.z - sin * W);
    const hr = heightAt(this.position.x - cos * W, this.position.z + sin * W);
    this.tiltPitchT = Math.atan2(hb - hf, 2 * L);
    this.tiltRollT = Math.atan2(hl - hr, 2 * W);
    // per-foot delta vs the tilted body plane
    const feet = d.feet;
    for (let i = 0; i < Math.min(4, feet.length); i++) {
      const ft = feet[i];
      if (ft === undefined) continue;
      const fx = ft[0] * this.scale, fz = ft[1] * this.scale;
      const wx = this.position.x + cos * fx + sin * fz, wz = this.position.z - sin * fx + cos * fz;
      const planeY = this.groundY - Math.tan(this.tiltPitchT) * fz + Math.tan(this.tiltRollT) * fx;
      this.footDeltaT[i] = THREE.MathUtils.clamp(heightAt(wx, wz) - planeY, -0.35, 0.35);
    }
  }


  private easeTilt(k: number): void {
    this.tiltPitch += (this.tiltPitchT - this.tiltPitch) * k;
    this.tiltRoll += (this.tiltRollT - this.tiltRoll) * k;
  }
  private applyTerrain(dt: number): void {
    const k = Math.min(1, dt * 5);
    this.easeTilt(k);
    let minD = 0;
    for (let i = 0; i < 4; i++) {
      this.footDelta[i] = (this.footDelta[i] ?? 0) + ((this.footDeltaT[i] ?? 0) - (this.footDelta[i] ?? 0)) * k;
      minD = Math.min(minD, this.footDelta[i] ?? 0);
    }
    if (!this.alive || this.custom) return;
    const legLen = this.model.dims.legLen;
    const p = this.pose;
    // lower the body so the lowest hoof reaches the ground, flex knees for feet on higher ground
    p[P_BODY_Y] = (p[P_BODY_Y] ?? 0) + minD * 0.7;
    for (let i = 0; i < 4; i++) {
      const dlt = (this.footDelta[i] ?? 0) - minD * 0.7;
      if (dlt > 0.005) {
        const f = Math.min(1.2, dlt / legLen) * 1.6;
        this.add(P_LEG + i * 3 + 1, f);                 // knee/hock flex
        this.add(P_LEG + i * 3, (i < 2 ? 0.25 : -0.15) * f);
        this.add(P_LEG + i * 3 + 2, (i < 2 ? 0.2 : -0.35) * f);
      }
    }
  }

}
