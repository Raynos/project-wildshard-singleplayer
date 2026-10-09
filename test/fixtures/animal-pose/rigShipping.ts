import * as THREE from 'three';
import { Animal } from '../../../src/engine/entities/AnimalView';
import type { AnimalModel, AnimalRig } from '../../../src/engine/entities/AnimalFactory';
import type { RigAnimCtx } from '../../../src/engine/entities/species/registry';
import { heightAt } from '../../../src/engine/world/Heightfield';
import { ShippingAnimalPoseOracle } from './shipping';
import { shippingCrab, shippingMonkey, shippingSailor } from './customShipping';

const P_BODY_Y = 0, P_BODY_PITCH = 1, P_BODY_ROLL = 2, P_BODY_YAW = 3;
const P_NECK1 = 4, P_NECK2 = 5, P_HEAD_P = 6, P_HEAD_Y = 7, P_NECK_Y = 8;
const P_EARL_P = 9, P_EARL_Y = 10, P_EARR_P = 11, P_EARR_Y = 12;
const P_TAIL_P = 13, P_TAIL_Y = 14, P_LEG = 15;
const smooth01 = (t: number) => t * t * (3 - 2 * t);
type Quad = Record<'body'|'neck1'|'neck2'|'head'|'earL'|'earR'|'tail'|'belly',THREE.Bone>;

/** Test ingress for owned actor clocks; it never changes the production pose or body methods. */
export class PoseViewFixture extends Animal {
  prime(phase: number): void {
    if (phase === 0) { this.flinch = 1; this.brace = 1; this.deathT = -1; }
    if (phase === 900) this.deathT = 0;
    this.flinchRoll = .12; this.flinchPitch = -.08; this.deathSide = -1;
    this.attackT = phase < 30 ? phase / 60 : -1; this.attackDur = .6;
  }
}

/** Source-frozen scalar-to-joint/root mapping, over the real factory's bones and real custom callbacks.
 * Flash, corpse fades and ragdoll rendering are outside this pose oracle; binding contracts test them separately. */
export class ShippingRigPoseOracle extends PoseViewFixture {
  private readonly scalar: ShippingAnimalPoseOracle;
  private readonly shippingModel: AnimalModel;
  private readonly shippingQuad: Quad|null;
  private readonly shippingLegs: (readonly [THREE.Bone,THREE.Bone,THREE.Bone])[];
  private readonly shippingLegAbd = new Float32Array(4);
  private shippingBreathPhase=0;
  private readonly shippingCtx: RigAnimCtx;
  constructor(rig:AnimalRig,model:AnimalModel,seed:number,scale:number,id:string) {
    super(rig,model,seed,scale,id);this.shippingModel=model;
    this.scalar=new ShippingAnimalPoseOracle({dims:model.dims,custom:this.custom,...(model.species.gait===undefined?{}:{gait:model.species.gait}),...(model.species.pose===undefined?{}:{pose:model.species.pose})});
    this.scalar.onFootfall=(_owner,strength)=>{this.onFootfall?.(this,strength);};
    const bone=(name:string):THREE.Bone=>{const value=rig.bones[name];if(value===undefined)throw new Error('Missing shipping joint');return value;};
    this.shippingQuad=this.custom?null:{body:bone('body'),neck1:bone('neck1'),neck2:bone('neck2'),head:bone('head'),earL:bone('earL'),earR:bone('earR'),tail:bone('tail'),belly:bone('belly')};
    this.shippingLegs=this.custom?[]:[['FL_shoulder','FL_carpus','FL_fetlock'],['FR_shoulder','FR_carpus','FR_fetlock'],['BL_hip','BL_stifle','BL_hock'],['BR_hip','BR_stifle','BR_hock']].map(([a,b,c])=>{if(a===undefined||b===undefined||c===undefined)throw new Error('Missing shipping leg');return [bone(a),bone(b),bone(c)] as const;});
    this.shippingCtx={bones:rig.bones,dims:model.dims,dt:0,t:0,seed,scale,speed:0,strafe:0,phase:0,state:'idle',alive:true,deathT:-1,flinch:0,brace:0,attack:-1,lookTarget:this.lookTarget,lookWeight:0,position:this.position,yaw:0,mem:this.mem,animal:this};
  }
  private shippingInputs():void {
    const i=this.scalar.input;
    i.speed=this.speed;i.strafe=this.strafe;i.scale=this.scale;i.seed=this.seed;i.state=this.state;i.alive=this.alive;
    i.position=this.position;i.lookTarget=this.lookTarget;i.yaw=this.yaw;i.lookWeight=this.lookWeight;
    i.flinch=this.flinch;i.flinchRoll=this.flinchRoll;i.flinchPitch=this.flinchPitch;i.brace=this.brace;i.stunT=this.stunT;
    i.deathT=this.deathT;i.deathSide=this.deathSide;i.attackT=this.attackT;i.attackDur=this.attackDur;
    i.groundY=this.groundY;i.tiltRollT=this.tiltRollT;i.levelGround=this.levelGround;i.flying=this.flight!==null;
    i.advanceAttack=true;i.desiredSpeed=this.desiredSpeed;i.debugGait=this.debugGait;
  }
  override sampleTerrain():void {this.shippingInputs();this.scalar.sampleTerrain(heightAt);this.tiltRollT=this.scalar.input.tiltRollT;}
  override update(dt:number,t:number,near:boolean):void {
    this.poseFrozen=false;this.stepMotion(dt);this.shippingInputs();this.scalar.advance(dt,t,near);
    const i=this.scalar.input;this.speed=i.speed;this.desiredSpeed=i.desiredSpeed;this.attackT=i.attackT;this.flinch=i.flinch;this.brace=i.brace;this.deathT=i.deathT;
    if(!near){this.shippingApplyRoot();this.poseFrozen=true;return;}
    if(!this.custom)this.shippingApplyPose(dt);
    const c=this.shippingCtx;
    c.dt=dt;c.t=t;c.speed=this.speed;c.strafe=this.strafe;c.phase=this.scalar.phase;c.state=this.state;c.alive=this.alive;
    c.deathT=this.deathT;c.flinch=this.flinch;c.brace=smooth01(this.brace);c.attack=this.attackPhase;c.lookWeight=this.scalar.lookAmt;c.yaw=this.yaw;
    if(this.custom){if(this.kind==='crab')shippingCrab(c);else if(this.kind==='monkey')shippingMonkey(c);else if(this.kind==='sailor')shippingSailor(c);else throw new Error('Missing captured custom callback');}else this.shippingModel.species.postPose?.(c);
    this.shippingApplyRoot();
  }
  private shippingApplyPose(dt: number): void {
    const p = this.scalar.pose, b = this.shippingQuad, d = this.shippingModel.dims;
    if (b === null) return;
    b.body.position.y = d.bodyY + (p[P_BODY_Y] ?? 0);
    b.body.rotation.set(p[P_BODY_PITCH] ?? 0, p[P_BODY_YAW] ?? 0, p[P_BODY_ROLL] ?? 0, 'YXZ');
    b.neck1.rotation.set(p[P_NECK1] ?? 0, (p[P_NECK_Y] ?? 0) * 0.5, 0);
    b.neck2.rotation.set(p[P_NECK2] ?? 0, (p[P_NECK_Y] ?? 0) * 0.5, 0);
    b.head.rotation.set(p[P_HEAD_P] ?? 0, p[P_HEAD_Y] ?? 0, 0);
    b.earL.rotation.set(-(p[P_EARL_P] ?? 0), 0, -(p[P_EARL_Y] ?? 0));   // ear pitch: + = laid back
    b.earR.rotation.set(-(p[P_EARR_P] ?? 0), 0, -(p[P_EARR_Y] ?? 0));
    b.tail.rotation.set(p[P_TAIL_P] ?? 0, 0, p[P_TAIL_Y] ?? 0);
    const dead = !this.alive ? smooth01(Math.max(0, this.deathT)) : 0;
    for (let l = 0; l < 4; l++) {
      const leg = this.shippingLegs[l];
      if (leg === undefined) continue;
      const [u, m, lo] = leg;
      u.rotation.x = -(p[P_LEG + l * 3] ?? 0);
      m.rotation.x = p[P_LEG + l * 3 + 1] ?? 0;
      lo.rotation.x = p[P_LEG + l * 3 + 2] ?? 0;
      // keyframed corpse: legs swing sideways by legAbd; ground is local +X when the body rolled onto its left side
      // (side < 0), local -X otherwise
      u.rotation.z = dead * (this.shippingLegAbd[l] ?? 0) * (this.deathSide < 0 ? 1 : -1);
    }
    // breathing: the belly bone swells (visible at a few metres), faster after running
    if (this.alive) {
      const rate = 1.4 + 2.6 * Math.min(1, this.speed / 6);
      this.shippingBreathPhase += rate * dt * 2 * Math.PI * 0.45;
      const br = 0.5 + 0.5 * Math.sin(this.shippingBreathPhase);
      const sc = 1 + 0.045 * br;
      b.belly.scale.set(sc, sc * 0.85, 1 + 0.01 * br);
    }
  }
  private shippingApplyRoot(): void {
    const m = this.mesh;
    m.position.copy(this.position);
    // a custom rig has no flinch in its bones' pose code here: the whole body leans away from the blow instead
    const f = this.custom && this.alive ? this.flinch * 1.8 : 0;
    m.rotation.set(this.scalar.tiltPitch + this.flinchPitch * f, this.yaw, this.scalar.tiltRoll + this.flinchRoll * f, 'YXZ');
  }
}
