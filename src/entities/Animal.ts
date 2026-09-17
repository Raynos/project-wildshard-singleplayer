import * as THREE from 'three';
import { heightAt } from '../world/Heightfield';
import type { AnimalKind, AnimalModel, AnimalRig } from './AnimalFactory';

/**
 * Animal — one deer or boar instance: procedural skeletal animation + health.
 *
 * Animation is a weighted blend of gait/idle pose generators (idle, graze, walk, trot, gallop)
 * written into a flat Float32Array of joint angles, plus additive layers (alert look-at,
 * hit flinch, death collapse) and terrain adaptation (body tilt to the slope, per-foot
 * knee flex so hooves plant). The result is applied to the rig's bones every frame.
 *
 * Public surface used by other systems:
 *   animal.kind: 'deer' | 'boar'      animal.alive      animal.position (feet, world)
 *   animal.hp / maxHp                 animal.state       animal.yaw (heading, radians)
 *   animal.applyDamage(amount, hitPoint, dir) → true if it died
 *   animal.headWorld(out) / bodyCapsule(a, b)  — hit volumes (world space)
 *
 * The AnimalManager owns AI state and calls animal.setMotion(desiredYaw, desiredSpeed).
 */

export type AnimalState = 'idle' | 'graze' | 'wander' | 'alert' | 'flee' | 'charge' | 'dead';

// pose parameter indices
const P_BODY_Y = 0, P_BODY_PITCH = 1, P_BODY_ROLL = 2, P_BODY_YAW = 3;
const P_NECK1 = 4, P_NECK2 = 5, P_HEAD_P = 6, P_HEAD_Y = 7, P_NECK_Y = 8;
const P_EARL_P = 9, P_EARL_Y = 10, P_EARR_P = 11, P_EARR_Y = 12;
const P_TAIL_P = 13, P_TAIL_Y = 14;
const P_LEG = 15; // + leg*3 (0 upper, 1 mid, 2 lower)   legs: 0 FL, 1 FR, 2 BL, 3 BR
const P_COUNT = 27;

const G_IDLE = 0, G_GRAZE = 1, G_WALK = 2, G_TROT = 3, G_GALLOP = 4;

interface GaitDef { offsets: [number, number, number, number]; stance: number; amp: number; lift: number; bob: number; pitch: number }
const GAITS: Record<number, GaitDef> = {
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

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Animal {
  kind: AnimalKind;
  alive = true;
  hp: number; maxHp: number;
  position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  state: AnimalState = 'idle';
  mesh: THREE.SkinnedMesh;
  herd = 0;
  /** AI writes these; the animal steers toward them every frame */
  desiredYaw = 0; desiredSpeed = 0; turnRate = 2.5;
  /** where the head should look (world) while alert; weight 0..1 */
  lookTarget = new THREE.Vector3(); lookWeight = 0;
  /** an extra per-animal AI scratch: timers etc. are kept on the manager side */
  seed: number;
  scale: number;

  private bones: Record<string, THREE.Bone>;
  private model: AnimalModel;
  private pose = new Float32Array(P_COUNT);
  private tmp = new Float32Array(P_COUNT);
  private gaitW = new Float32Array(5);
  private gaitTarget = new Float32Array(5);
  private phase = 0;
  private lookAmt = 0;
  private flinch = 0; private flinchRoll = 0; private flinchPitch = 0;
  private deathT = -1; private deathSide = 1;
  private tiltPitch = 0; private tiltRoll = 0; private groundY = 0;
  private footDelta = new Float32Array(4);
  private legDir: THREE.Bone[][] = [];
  private breathe = 0;
  private lastFootPhase = new Float32Array(4);
  /** called when a hoof plants during a gait (index, phase strength) — the manager turns it into sounds */
  onFootfall?: (animal: Animal, strength: number) => void;
  /** dev hook: freeze the animation at a gait ('idle'|'graze'|'walk'|'trot'|'gallop') and phase (0..1) */
  debugGait?: { gait: string; phase: number };

  constructor(rig: AnimalRig, model: AnimalModel, seed: number, scale = 1) {
    this.kind = model.kind;
    this.mesh = rig.mesh; this.bones = rig.bones; this.model = model; this.seed = seed; this.scale = scale;
    this.maxHp = this.hp = model.kind === 'deer' ? 60 : 90;
    this.mesh.scale.setScalar(scale);
    this.mesh.rotation.order = 'YXZ';
    const b = this.bones;
    this.legDir = [
      [b.FL_shoulder, b.FL_carpus, b.FL_fetlock], [b.FR_shoulder, b.FR_carpus, b.FR_fetlock],
      [b.BL_hip, b.BL_stifle, b.BL_hock], [b.BR_hip, b.BR_stifle, b.BR_hock],
    ];
    this.gaitW[G_IDLE] = 1;
  }

  get dims() { return this.model.dims; }

  /** place on the ground, facing `yaw` */
  place(x: number, z: number, yaw: number) {
    this.position.set(x, heightAt(x, z), z);
    this.groundY = this.position.y;
    this.yaw = this.desiredYaw = yaw;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = yaw;
  }

  setMotion(desiredYaw: number, desiredSpeed: number, turnRate = 2.5) {
    this.desiredYaw = desiredYaw; this.desiredSpeed = desiredSpeed; this.turnRate = turnRate;
  }

  // ── combat ─────────────────────────────────────────────────────────────────────────────

  /** world-space head hit sphere centre */
  headWorld(out: THREE.Vector3) {
    const m = this.bones.head.matrixWorld.elements;
    return out.set(m[12], m[13], m[14]);
  }
  /** world-space body capsule segment (a = rump, b = chest) */
  bodyCapsule(a: THREE.Vector3, b: THREE.Vector3) {
    const d = this.model.dims;
    const m = this.bones.body.matrixWorld.elements;
    // body bone world matrix: columns are the body axes in world space
    const cx = m[12], cy = m[13], cz = m[14];
    const fx = m[8] * d.bodyHalfLen, fy = m[9] * d.bodyHalfLen, fz = m[10] * d.bodyHalfLen;
    a.set(cx - fx, cy - fy, cz - fz); b.set(cx + fx, cy + fy, cz + fz);
  }

  /** Apply damage; `hitPoint`/`dir` (world) drive the flinch and the collapse side. Returns true if this shot killed it. */
  applyDamage(amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    // flinch away from the shot: project the shot direction into body space
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    const lx = dir.x * cos - dir.z * sin;      // +x = animal's left
    const lz = dir.x * sin + dir.z * cos;      // +z = forward
    this.flinch = 1;
    this.flinchRoll = -lx * 0.25;
    this.flinchPitch = -lz * 0.12 + (hitPoint.y - this.position.y > this.model.dims.bodyY ? 0.05 : -0.03);
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; this.state = 'dead';
      this.deathT = 0; this.deathSide = lx >= 0 ? 1 : -1; // falls away from the shot
      this.desiredSpeed = 0;
      return true;
    }
    return false;
  }

  // ── per-frame ──────────────────────────────────────────────────────────────────────────

  /** Integrate motion and animate. `t` = global seconds; `near` = within animation LOD range. */
  update(dt: number, t: number, near: boolean) {
    const d = this.model.dims;
    if (this.alive) {
      // heading + speed steering
      let dy = this.desiredYaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const maxTurn = this.turnRate * dt;
      this.yaw += THREE.MathUtils.clamp(dy, -maxTurn, maxTurn);
      const accel = this.desiredSpeed > this.speed ? 7 : 11;
      this.speed += THREE.MathUtils.clamp(this.desiredSpeed - this.speed, -accel * dt, accel * dt);
      if (this.speed > 0.01) {
        this.position.x += Math.sin(this.yaw) * this.speed * dt;
        this.position.z += Math.cos(this.yaw) * this.speed * dt;
      }
    } else this.speed = 0;

    // ground follow (smoothed so bumps in the heightfield don't jitter the body)
    const gy = heightAt(this.position.x, this.position.z);
    this.groundY += (gy - this.groundY) * Math.min(1, dt * 12);
    this.position.y = this.groundY;

    // gait weights from speed
    const gw = this.gaitTarget;
    gw.fill(0);
    const s = this.speed / this.scale;
    if (this.debugGait) {
      const gi = ['idle', 'graze', 'walk', 'trot', 'gallop'].indexOf(this.debugGait.gait);
      this.gaitW.fill(0); this.gaitW[Math.max(0, gi)] = 1; this.phase = this.debugGait.phase;
      this.speed = 0; this.desiredSpeed = 0;
      gw.set(this.gaitW);
    } else if (!this.alive) { gw[G_IDLE] = 1; }
    else if (s < 0.15) { if (this.state === 'graze') gw[G_GRAZE] = 1; else gw[G_IDLE] = 1; }
    else if (s < 2.4) { const k = THREE.MathUtils.clamp((s - 0.15) / 0.6, 0, 1); gw[G_WALK] = k; gw[this.state === 'graze' ? G_GRAZE : G_IDLE] = 1 - k; }
    else if (s < 4.6) { const k = THREE.MathUtils.clamp((s - 2.4) / 1.2, 0, 1); gw[G_TROT] = k; gw[G_WALK] = 1 - k; }
    else { const k = THREE.MathUtils.clamp((s - 4.6) / 1.4, 0, 1); gw[G_GALLOP] = k; gw[G_TROT] = 1 - k; }
    const bl = Math.min(1, dt * 6);
    let wsum = 0;
    for (let i = 0; i < 5; i++) { this.gaitW[i] += (gw[i] - this.gaitW[i]) * bl; wsum += this.gaitW[i]; }
    for (let i = 0; i < 5; i++) this.gaitW[i] /= wsum;

    // gait phase: stride frequency from speed so hooves don't slide
    const moving = this.gaitW[G_WALK] + this.gaitW[G_TROT] + this.gaitW[G_GALLOP];
    if (moving > 0.01 && this.alive && !this.debugGait) {
      const g = this.gaitW[G_GALLOP] > 0.5 ? GAITS[G_GALLOP] : this.gaitW[G_TROT] > 0.5 ? GAITS[G_TROT] : GAITS[G_WALK];
      const stride = 2 * d.legLen * Math.sin(g.amp) * this.scale * (g === GAITS[G_GALLOP] ? 1.9 : g === GAITS[G_TROT] ? 1.35 : 1.0);
      const freq = Math.max(0.6, this.speed * g.stance / stride);
      this.phase = (this.phase + freq * dt) % 1;
    }

    if (!near) {
      // far LOD: just move the root; skip pose maths (skeleton keeps its last pose)
      this.applyRoot();
      return;
    }

    const pose = this.pose;
    pose.fill(0);
    const seed = this.seed;
    // ── blended base layers ──
    if (this.gaitW[G_IDLE] > 0.001) { this.poseIdle(t, seed); this.accumulate(this.gaitW[G_IDLE]); }
    if (this.gaitW[G_GRAZE] > 0.001) { this.poseGraze(t, seed); this.accumulate(this.gaitW[G_GRAZE]); }
    for (const g of [G_WALK, G_TROT, G_GALLOP]) if (this.gaitW[g] > 0.001) { this.poseGait(GAITS[g], t, seed); this.accumulate(this.gaitW[g]); }

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
      pose[P_NECK_Y] += ly * 0.55 * this.lookAmt;
      pose[P_HEAD_Y] += ly * 0.45 * this.lookAmt;
      pose[P_HEAD_P] += lp * this.lookAmt;
      // head up, ears pricked forward, neck raised
      pose[P_NECK1] -= 0.18 * this.lookAmt; pose[P_NECK2] -= 0.1 * this.lookAmt;
      pose[P_EARL_P] -= 0.35 * this.lookAmt; pose[P_EARR_P] -= 0.35 * this.lookAmt;
      pose[P_EARL_Y] += 0.25 * this.lookAmt; pose[P_EARR_Y] -= 0.25 * this.lookAmt;
    }

    // ── hit flinch (additive, decays) ──
    if (this.flinch > 0.001) {
      const f = this.flinch;
      pose[P_BODY_ROLL] += this.flinchRoll * f;
      pose[P_BODY_PITCH] += this.flinchPitch * f;
      pose[P_BODY_Y] -= 0.06 * f * d.bodyY;
      pose[P_HEAD_P] += 0.35 * f; pose[P_NECK1] -= 0.2 * f;
      pose[P_EARL_P] += 0.5 * f; pose[P_EARR_P] += 0.5 * f;
      pose[P_TAIL_P] -= 0.6 * f;
      this.flinch *= Math.exp(-dt * 5.5);
    }

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
        const front = l < 2, down = (l % 2 === 0) === (side > 0); // legs on the ground side tuck, top legs stretch
        this.blendTo(P_LEG + l * 3, (front ? -0.55 : 0.35) * (down ? 1 : 0.6) + 0.25 * buckle, k);
        this.blendTo(P_LEG + l * 3 + 1, (front ? 0.9 : 0.8) * (down ? 1 : 0.55) * buckle, k);
        this.blendTo(P_LEG + l * 3 + 2, (front ? 0.3 : -0.5) * buckle, k);
      }
    }

    this.applyTerrain(dt);
    this.applyPose();
    this.applyRoot();
  }

  // ── pose generators (write into this.tmp) ────────────────────────────────────────────

  private accumulate(w: number) { const p = this.pose, t = this.tmp; for (let i = 0; i < P_COUNT; i++) p[i] += t[i] * w; }
  private blendTo(i: number, v: number, k: number) { this.pose[i] += (v - this.pose[i]) * k; }

  private poseIdle(t: number, seed: number) {
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

  private poseGraze(t: number, seed: number) {
    this.poseIdle(t, seed);
    const p = this.tmp;
    const deer = this.kind === 'deer';
    // head to the ground; deer need the whole neck down, boars only nose down a little
    p[P_NECK1] = deer ? 1.05 : 0.35; p[P_NECK2] = deer ? 0.85 : 0.2; p[P_HEAD_P] = deer ? 0.55 : 0.35;
    p[P_NECK_Y] *= 0.6; p[P_HEAD_Y] *= 0.4;
    // nibbling
    const nib = Math.sin(t * 6 + seed) * 0.5 + 0.5;
    p[P_HEAD_P] += 0.05 * nib; p[P_HEAD_Y] += 0.08 * Math.sin(t * 2.2 + seed);
    // front legs a touch spread / one forward
    p[P_LEG + 0] = 0.1; p[P_LEG + 3] = -0.06;
    p[P_EARL_Y] = 0.5 + 0.3 * pulse(t, 3.1, seed); p[P_EARR_Y] = -0.5 - 0.3 * pulse(t, 4.4, seed + 0.3);
  }

  private poseGait(g: GaitDef, t: number, seed: number) {
    const p = this.tmp; p.fill(0);
    const ph = this.phase;
    const gallop = g === GAITS[G_GALLOP], trot = g === GAITS[G_TROT];
    for (let l = 0; l < 4; l++) {
      const lp = (ph + g.offsets[l]) % 1;
      const front = l < 2;
      let upper: number, mid: number, lower: number;
      if (lp < g.stance) {
        const u = lp / g.stance;
        upper = g.amp * (1 - 2 * u);                                 // foot on the ground sweeping back
        mid = 0.12 * g.lift * Math.sin(u * Math.PI) * 0.35;
        lower = 0.1 * Math.sin(u * Math.PI);
        if (u < 0.08 && this.lastFootPhase[l] > 0.5) this.onFootfall?.(this, gallop ? 1 : trot ? 0.6 : 0.35);
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
    p[P_TAIL_P] = gallop ? (this.kind === 'deer' ? 1.0 : 0.5) : 0.1 + 0.15 * beat;   // + = raised
    p[P_TAIL_Y] = Math.sin(ph * Math.PI * 2) * 0.15;
  }

  // ── terrain adaptation ──────────────────────────────────────────────────────────────────

  /** Sample the slope under the body (called by the manager at 10 Hz — heightAt is not free). */
  sampleTerrain() {
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
    for (let i = 0; i < 4; i++) {
      const fx = feet[i][0] * this.scale, fz = feet[i][1] * this.scale;
      const wx = this.position.x + cos * fx + sin * fz, wz = this.position.z - sin * fx + cos * fz;
      const planeY = this.groundY - Math.tan(this.tiltPitchT) * fz + Math.tan(this.tiltRollT) * fx;
      this.footDeltaT[i] = THREE.MathUtils.clamp(heightAt(wx, wz) - planeY, -0.35, 0.35);
    }
  }
  private tiltPitchT = 0; private tiltRollT = 0; private footDeltaT = new Float32Array(4);

  private applyTerrain(dt: number) {
    const k = Math.min(1, dt * 5);
    this.tiltPitch += (this.tiltPitchT - this.tiltPitch) * k;
    this.tiltRoll += (this.tiltRollT - this.tiltRoll) * k;
    let minD = 0;
    for (let i = 0; i < 4; i++) {
      this.footDelta[i] += (this.footDeltaT[i] - this.footDelta[i]) * k;
      minD = Math.min(minD, this.footDelta[i]);
    }
    if (!this.alive) return;
    const legLen = this.model.dims.legLen;
    const p = this.pose;
    // lower the body so the lowest hoof reaches the ground, flex knees for feet on higher ground
    p[P_BODY_Y] += minD * 0.7;
    for (let i = 0; i < 4; i++) {
      const dlt = this.footDelta[i] - minD * 0.7;
      if (dlt > 0.005) {
        const f = Math.min(1.2, dlt / legLen) * 1.6;
        p[P_LEG + i * 3 + 1] += f;                 // knee/hock flex
        p[P_LEG + i * 3] += (i < 2 ? 0.25 : -0.15) * f;
        p[P_LEG + i * 3 + 2] += (i < 2 ? 0.2 : -0.35) * f;
      }
    }
  }

  // ── apply to bones ──────────────────────────────────────────────────────────────────────

  private applyPose() {
    const p = this.pose, b = this.bones, d = this.model.dims;
    b.body.position.y = d.bodyY + p[P_BODY_Y];
    b.body.rotation.set(p[P_BODY_PITCH], p[P_BODY_YAW], p[P_BODY_ROLL], 'YXZ');
    b.neck1.rotation.set(p[P_NECK1], p[P_NECK_Y] * 0.5, 0);
    b.neck2.rotation.set(p[P_NECK2], p[P_NECK_Y] * 0.5, 0);
    b.head.rotation.set(p[P_HEAD_P], p[P_HEAD_Y], 0);
    b.earL.rotation.set(-p[P_EARL_P], 0, -p[P_EARL_Y]);   // ear pitch: + = laid back
    b.earR.rotation.set(-p[P_EARR_P], 0, -p[P_EARR_Y]);
    b.tail.rotation.set(p[P_TAIL_P], 0, p[P_TAIL_Y]);
    for (let l = 0; l < 4; l++) {
      const [u, m, lo] = this.legDir[l];
      u.rotation.x = -p[P_LEG + l * 3];
      m.rotation.x = p[P_LEG + l * 3 + 1];
      lo.rotation.x = p[P_LEG + l * 3 + 2];
    }
  }

  private applyRoot() {
    const m = this.mesh;
    m.position.copy(this.position);
    m.rotation.set(this.tiltPitch, this.yaw, this.tiltRoll, 'YXZ');
  }
}

export { P_COUNT };
