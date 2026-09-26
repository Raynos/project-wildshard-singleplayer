// Lab P9 "grapple" (E169): the FIRE → FLY → HOOK → REEL / ZIP choreography as a pure function of time, so a frame
// strip, a video and the live page all show exactly the same thing. Two takes:
//   'hook'  aim · lock the dragon hook · fire · fly · bite · go taut · ZIP across the Well · release · vault · land
//   'miss'  aim at empty air · fire · fly to the line's end · snap · the reel-back with the line whipping · dock
// evaluate(t) returns every pose and effect weight; the rope (./line.ts) is stepped from its launch at a fixed 240 Hz
// with anchors taken from evaluate() at each step (Timeline.rope).
import { Matrix4, Quaternion, Vector2, Vector3 } from 'three';
import { armMatrix, CLAW_PIVOT, EYELET, MUZZLE, TALON_ARMED, TALON_FOLD, TALON_GRIP, TALON_OPEN } from './feizhua';
import { Rope } from './line';

export type Take = 'hook' | 'miss';

export interface Frame {
  t: number;
  camPos: Vector3;
  camQuat: Quaternion;
  /** portrait horizontal FOV of the world camera (deg); the viewmodel keeps BASE_HFOV */
  hfov: number;
  arm: { wrist: Vector3; fwd: Vector3; roll: number };
  claw: 'docked' | 'flying';
  clawPos: Vector3;
  clawQuat: Quaternion;
  clawScale: number;
  talon: number;
  line: boolean;
  slack: number;
  pulse: number;
  lineI: number;
  spool: number;
  leds: [number, number, number];
  ledGold: number;
  cap: number;
  eyelet: number;
  /** muzzle flash progress (−1 = none), bite flash progress, the bite's sparks time (−1 = none), dock click */
  flash: number;
  bite: number;
  sparks: number;
  click: number;
  /** reticle: NDC target, lock 0..1, alpha, the bracket scale */
  ret: { at: Vector2; lock: number; alpha: number; size: number };
  hookLock: number;
  /** zip: speed 0..1 (speed lines, smear), focus in NDC */
  speed: number;
  focus: Vector2;
  shake: number;
}

export const BASE_HFOV = 62;
const DT = 1 / 240;

const sat = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number): number => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const v3 = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
function bez3(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return p0.clone().multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
}
/** a damped spring settle from 0 to 1 (overshoots once) */
function spring(x: number, k = 16, z = 0.35): number {
  if (x <= 0) return 0;
  return 1 - Math.exp(-z * k * x) * Math.cos(k * Math.sqrt(1 - z * z) * x);
}
/** trauma → a small rotation noise (yaw, pitch, roll in rad) */
function shakeRot(t: number, trauma: number): [number, number, number] {
  const s = trauma * trauma;
  const n = (f: number, p: number): number => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.4;
  return [n(47, 0.3) * 0.022 * s, n(53, 1.9) * 0.02 * s, n(41, 4.2) * 0.03 * s];
}

// the viewmodel's poses (view space; the vm camera at the origin looking down −Z)
const REST = { wrist: v3(-0.17, -0.22, -0.55), fwd: v3(0.4, 0.6, -1).normalize(), roll: 0.62 };
const AIM_WRIST = v3(-0.17, -0.13, -0.6);
const ZIP_WRIST = v3(-0.12, -0.08, -0.66);

export interface SetPoints {
  start: Vector3;
  landing: Vector3;
  /** the dragon hook's ring centre and the way it faces */
  anchor: Vector3;
  facing: Vector3;
}

const _m = new Matrix4();

export class Timeline {
  readonly rope = new Rope(44);
  private readonly sp: SetPoints;
  private ropeT = -1;
  private ropeTake: Take = 'hook';
  aspect = 402 / 874;

  constructor(sp: SetPoints) { this.sp = sp; }

  duration(take: Take): number { return take === 'hook' ? 3.6 : 2.4; }
  fireAt(take: Take): number { return take === 'hook' ? 0.72 : 0.52; }

  private lookQuat(from: Vector3, to: Vector3, roll: number, out: Quaternion): Quaternion {
    _m.lookAt(from, to, new Vector3(0, 1, 0));
    out.setFromRotationMatrix(_m);
    if (roll !== 0) out.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
    return out;
  }

  /** a view-space point of the viewmodel → world, through the world camera at the same view depth (FOV-matched) */
  vmToWorld(f: Frame, v: Vector3, out = new Vector3()): Vector3 {
    const k = Math.tan((f.hfov * Math.PI) / 360) / Math.tan((BASE_HFOV * Math.PI) / 360);
    return out.set(v.x * k, v.y * k, v.z).applyQuaternion(f.camQuat).add(f.camPos);
  }

  /** world → NDC for the world camera of frame f */
  ndc(f: Frame, w: Vector3, out = new Vector2()): Vector2 {
    const v = w.clone().sub(f.camPos).applyQuaternion(f.camQuat.clone().invert());
    const th = Math.tan((f.hfov * Math.PI) / 360);
    const tv = th / this.aspect;
    const z = Math.max(-v.z, 1e-3);
    return out.set(v.x / z / th, v.y / z / tv);
  }

  /** the arm's muzzle in world space */
  muzzleWorld(f: Frame, out = new Vector3()): Vector3 {
    armMatrix(f.arm.wrist, f.arm.fwd, f.arm.roll, _m);
    return this.vmToWorld(f, MUZZLE.clone().applyMatrix4(_m), out);
  }

  /** the docked claw's centre in world space + its orientation (world) */
  private dockedClaw(f: Frame, pos: Vector3, quat: Quaternion): void {
    armMatrix(f.arm.wrist, f.arm.fwd, f.arm.roll, _m);
    this.vmToWorld(f, CLAW_PIVOT.clone().applyMatrix4(_m), pos);
    const q = new Quaternion();
    _m.decompose(new Vector3(), q, new Vector3());
    quat.copy(f.camQuat).multiply(q);
  }

  /** the claw's eyelet (the rope's far end) in world space */
  eyeletWorld(f: Frame, out = new Vector3()): Vector3 {
    return out.copy(EYELET).multiplyScalar(f.clawScale).applyQuaternion(f.clawQuat).add(f.clawPos);
  }

  evaluate(take: Take, t: number): Frame {
    return take === 'hook' ? this.hook(t) : this.miss(t);
  }

  private base(t: number): Frame {
    return {
      t, camPos: this.sp.start.clone(), camQuat: new Quaternion(), hfov: BASE_HFOV,
      arm: { wrist: REST.wrist.clone(), fwd: REST.fwd.clone(), roll: REST.roll },
      claw: 'docked', clawPos: new Vector3(), clawQuat: new Quaternion(), clawScale: 1, talon: TALON_FOLD,
      line: false, slack: 1.1, pulse: -1, lineI: 1, spool: 0, leds: [0.25, 0.25, 0.25], ledGold: 0, cap: 0.45, eyelet: 0.2,
      flash: -1, bite: -1, sparks: -1, click: -1,
      ret: { at: new Vector2(), lock: 0, alpha: 0, size: 1 }, hookLock: 0, speed: 0, focus: new Vector2(), shake: 0,
    };
  }

  /** the arm: rest → aim (raise), recoil at the shot, zip pull, lower after */
  private armPose(f: Frame, aimDirView: Vector3, raise: number, zip: number, tSinceFire: number, lower: number): void {
    const breathe = Math.sin(f.t * 2.1) * 0.004;
    // never aim the forearm sideways or back at the camera (after the hook passes behind): fall back to rest
    const aimFwd = aimDirView.z < -0.35 ? aimDirView.clone().add(v3(0.03, 0.07, 0)).normalize() : REST.fwd.clone();
    const wrist = REST.wrist.clone().lerp(AIM_WRIST, raise).lerp(ZIP_WRIST, zip);
    const fwd = REST.fwd.clone().lerp(aimFwd, raise).normalize();
    let roll = lerp(REST.roll, 0.34, raise);
    roll = lerp(roll, 0.28, zip);
    // recoil: kick back along the forearm and up, spring back
    if (tSinceFire >= 0 && tSinceFire < 0.4) {
      const k = Math.exp(-tSinceFire * 14) * Math.sin(Math.min(tSinceFire * 40, Math.PI * 0.5) + tSinceFire * 6);
      wrist.addScaledVector(fwd, -0.045 * k);
      wrist.y += 0.012 * k;
      fwd.y += 0.1 * k;
      fwd.normalize();
    }
    // the tug of a taut line: the arm trembles
    if (zip > 0) {
      wrist.x += Math.sin(f.t * 61) * 0.0025 * zip;
      wrist.y += Math.sin(f.t * 73 + 1) * 0.0025 * zip;
    }
    wrist.y += breathe;
    if (lower > 0) {
      wrist.lerp(REST.wrist, lower);
      fwd.lerp(REST.fwd, lower).normalize();
      roll = lerp(roll, REST.roll, lower);
    }
    f.arm.wrist.copy(wrist);
    f.arm.fwd.copy(fwd);
    f.arm.roll = roll;
  }

  private hook(t: number): Frame {
    const f = this.base(t);
    const S = this.sp.start, A = this.sp.anchor, Fc = this.sp.facing, L = this.sp.landing;
    const tf = this.fireAt('hook'), Tfly = 0.46, tb = tf + Tfly, tz0 = 1.36, tz1 = 2.3, tr = 2.3, tland = 2.95;
    const E = A.clone().addScaledVector(Fc, 1.15).add(v3(0, -0.8, 0));
    // ── camera ──
    let trauma = 0;
    const imp = (at: number, a: number, k: number): void => { if (t >= at) trauma += a * Math.exp(-(t - at) * k); };
    imp(tf, 0.45, 9);
    imp(tb, 0.55, 8);
    imp(tz0, 0.35, 5);
    imp(tland, 0.75, 7);
    let pos = S.clone();
    // the opening view looks down into the Well; the hook sits up and to the right (comp-B), the aim swings the arm,
    // not the camera; the camera turns to the hook when the line pulls
    const look0 = S.clone().add(v3(1.9, -2.5, -11));
    let target = look0.clone().lerp(A, smooth(tb - 0.05, tz0 + 0.35, t));
    let roll = 0;
    let hf = BASE_HFOV;
    // the tension beat: a dip and lean into the pull
    const lean = smooth(tb, tz0, t) * (1 - smooth(tz0, tz0 + 0.2, t));
    pos.y -= 0.05 * lean;
    if (t >= tz0) {
      const v = sat((t - tz0) / (tz1 - tz0));
      const z = (1 - Math.cos(Math.PI * v ** 1.35)) / 2;
      pos = S.clone().lerp(E, z);
      pos.y -= Math.sin(Math.PI * v) * 0.35;
      roll = Math.sin(Math.PI * v) * 0.06;
      hf = BASE_HFOV + 11 * smooth(0, 0.45, v) - 7 * smooth(0.55, 1, v);
      const dv = 0.02;
      const z2 = (1 - Math.cos(Math.PI * Math.min(1, v + dv) ** 1.35)) / 2;
      f.speed = sat(((z2 - z) / dv) * 0.62) * (1 - smooth(0.92, 1.0, v));
    }
    if (t >= tr) {
      const u = sat((t - tr) / (tland - tr));
      const e = u * u * (3 - 2 * u);
      // up over the dragon's head (south of it), across the rail beside the pillar, down onto the deck
      const c1 = E.clone().add(v3(0.2, 1.7, 0.9)), c2 = L.clone().add(v3(-1.7, 1.3, 0.2));
      pos = bez3(E, c1, c2, L, e);
      const lookEnd = L.clone().add(v3(-4.2, -1.1, -5));
      target = A.clone().lerp(lookEnd, smooth(0.05, 1.0, u));
      hf = lerp(BASE_HFOV + 4, BASE_HFOV, smooth(0, 0.8, u));
      roll = lerp(0.0, -0.04, Math.sin(Math.PI * u));
      f.speed = 0.2 * (1 - smooth(0, 0.3, u));
    }
    if (t >= tland) {
      const k = t - tland;
      pos.y -= 0.14 * Math.exp(-k * 7) * Math.sin(Math.min(k * 22, Math.PI));
      target = L.clone().add(v3(-4.2, -1.1 - 0.3 * Math.exp(-k * 6), -5));
    }
    f.camPos.copy(pos);
    f.hfov = hf;
    this.lookQuat(pos, target, roll, f.camQuat);
    const [sy, sx, sr] = shakeRot(t, Math.min(trauma, 1));
    f.camQuat.multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), sy)).multiply(new Quaternion().setFromAxisAngle(v3(1, 0, 0), sx)).multiply(new Quaternion().setFromAxisAngle(v3(0, 0, 1), sr));
    f.shake = trauma;
    // ── arm ──
    const inv = f.camQuat.clone().invert();
    const aimDir = A.clone().sub(f.camPos).applyQuaternion(inv).normalize();
    const raise = smooth(0.12, 0.52, t) * (1 - smooth(tr - 0.02, tr + 0.3, t));
    const zipA = smooth(tb + 0.02, tz0 + 0.12, t) * (1 - smooth(tr - 0.05, tr + 0.2, t));
    this.armPose(f, aimDir, raise, zipA, t - tf, 0);
    // ── reticle + lock ──
    const hookNdc = this.ndc(f, A);
    const search = smooth(0.0, 0.46, t);
    f.ret.at.set(0, 0).lerp(hookNdc, search);
    f.ret.lock = smooth(0.44, 0.52, t);
    f.ret.size = lerp(1.0, 0.42, spring(t - 0.44, 18, 0.4));
    f.ret.alpha = smooth(0.0, 0.12, t) * (1 - smooth(tb, tb + 0.25, t));
    f.hookLock = f.ret.lock * (1 - smooth(tland, tland + 0.5, t));
    f.focus.copy(hookNdc);
    // ── gauntlet state ──
    f.cap = lerp(0.45, 1.8, smooth(0.3, tf, t));
    if (t >= tf) f.cap = lerp(0.12, 0.6, smooth(tf + 0.2, tland, t));
    f.leds = [smooth(0.34, 0.38, t), smooth(0.44, 0.48, t), smooth(0.54, 0.58, t)].map((x) => 0.25 + 0.95 * x) as [number, number, number];
    if (t > tland + 0.3) f.leds = [0.3, 0.3, 0.3];
    f.ledGold = f.ret.lock * (1 - smooth(tland, tland + 0.3, t));
    f.flash = t >= tf && t < tf + 0.12 ? (t - tf) / 0.12 : -1;
    // ── claw ──
    if (t < tf) {
      f.claw = 'docked';
      f.talon = lerp(TALON_FOLD, TALON_ARMED, spring(t - 0.46, 20, 0.45));
    } else if (t < tr + 0.34) {
      f.claw = 'flying';
      f.line = true;
      f.eyelet = 1.6;
      // launch point = the docked claw at the moment of the shot
      const at0 = this.hook(Math.min(tf - 1e-4, t));
      const L0 = new Vector3(), Q0 = new Quaternion();
      this.dockedClaw(at0, L0, Q0);
      const B = A.clone().addScaledVector(Fc, 0.1);
      if (t < tb) {
        const u = (t - tf) / Tfly;
        const e = 1 - (1 - u) ** 1.7;
        const p = L0.clone().lerp(B, e);
        p.y += Math.sin(Math.PI * e) * 0.55;
        const p2 = L0.clone().lerp(B, Math.min(1, e + 0.02));
        p2.y += Math.sin(Math.PI * Math.min(1, e + 0.02)) * 0.55;
        f.clawPos.copy(p);
        this.lookQuat(p, p2, 1.4 * u, f.clawQuat);
        f.clawScale = lerp(1, 1.7, smooth(0.05, 0.85, u));
        f.talon = lerp(TALON_FOLD, TALON_OPEN, spring(t - tf - 0.02, 26, 0.45));
        f.slack = 1.05 + 0.12 * (1 - u);
        f.spool = (t - tf) * 60;
      } else if (t < tr) {
        f.clawPos.copy(B);
        this.lookQuat(B, B.clone().sub(Fc), 1.4, f.clawQuat);
        f.clawScale = 1.7;
        f.talon = lerp(TALON_OPEN, TALON_GRIP, spring(t - tb, 30, 0.5));
        f.slack = lerp(1.04, 1.0, smooth(tb, tb + 0.07, t));
        f.pulse = t < tb + 0.26 ? 1 - (t - tb) / 0.26 : -1;
        f.lineI = 1 + 1.4 * Math.exp(-(t - tb) * 6);
        f.spool = Tfly * 60 - Math.max(0, t - tz0) * 45;
      } else {
        // release: talons open, the claw is reeled home along the moving muzzle
        const u = (t - tr) / 0.34;
        const M = this.muzzleWorld(f);
        const e = u * u;
        const p = B.clone().lerp(M, e);
        p.y -= Math.sin(Math.PI * u) * 0.35;
        f.clawPos.copy(p);
        this.lookQuat(p, B.clone().addScaledVector(Fc, -2), 1.4 + u * 2, f.clawQuat);
        f.clawScale = lerp(1.7, 1, smooth(0.3, 1, u));
        f.talon = lerp(TALON_GRIP, TALON_OPEN * 0.8, smooth(0, 0.3, u));
        f.slack = 1.12;
        f.spool = Tfly * 60 - (tr - tz0) * 45 - (t - tr) * 90;
      }
    } else {
      f.claw = 'docked';
      f.talon = lerp(TALON_OPEN * 0.8, TALON_FOLD, smooth(tr + 0.34, tr + 0.5, t));
      f.click = t < tr + 0.34 + 0.1 ? (t - tr - 0.34) / 0.1 : -1;
    }
    if (t >= tb && t < tb + 0.3) f.bite = (t - tb) / 0.3;
    f.sparks = t >= tb && t < tb + 0.8 ? t - tb : -1;
    return f;
  }

  private miss(t: number): Frame {
    const f = this.base(t);
    const S = this.sp.start;
    const tf = this.fireAt('miss'), tsnap = tf + 0.5, trel = tsnap + 0.08, tdock = trel + 0.66;
    // aim left over the Well at empty air
    const aimPt = S.clone().add(v3(-4.2, 5.2, -22));
    let trauma = 0;
    const imp = (at: number, a: number, k: number): void => { if (t >= at) trauma += a * Math.exp(-(t - at) * k); };
    imp(tf, 0.45, 9);
    imp(tsnap, 0.4, 9);
    imp(tdock, 0.25, 12);
    const target = S.clone().add(v3(1.9, -2.5, -11)).lerp(aimPt, smooth(0, 0.45, t));
    f.camPos.copy(S);
    this.lookQuat(S, target, 0, f.camQuat);
    const [sy, sx, sr] = shakeRot(t, Math.min(trauma, 1));
    f.camQuat.multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), sy)).multiply(new Quaternion().setFromAxisAngle(v3(1, 0, 0), sx)).multiply(new Quaternion().setFromAxisAngle(v3(0, 0, 1), sr));
    f.shake = trauma;
    const inv = f.camQuat.clone().invert();
    const aimDir = aimPt.clone().sub(f.camPos).applyQuaternion(inv).normalize();
    this.armPose(f, aimDir, smooth(0.08, 0.42, t), 0, t - tf, smooth(tdock + 0.05, tdock + 0.5, t));
    // the reticle searches and never locks: cyan brackets, wide
    f.ret.at.set(Math.sin(t * 3) * 0.02, Math.cos(t * 2.3) * 0.02);
    f.ret.lock = 0;
    f.ret.size = 1.0 + 0.05 * Math.sin(t * 9);
    f.ret.alpha = smooth(0, 0.12, t) * (1 - smooth(tf + 0.1, tf + 0.3, t));
    f.cap = lerp(0.45, 1.8, smooth(0.2, tf, t));
    if (t >= tf) f.cap = lerp(0.12, 0.6, smooth(tf + 0.2, tdock + 0.4, t));
    f.leds = [smooth(0.2, 0.24, t), smooth(0.3, 0.34, t), smooth(0.4, 0.44, t)].map((x) => 0.25 + 0.95 * x) as [number, number, number];
    f.flash = t >= tf && t < tf + 0.12 ? (t - tf) / 0.12 : -1;
    const range = 21;
    if (t < tf) {
      f.talon = lerp(TALON_FOLD, TALON_ARMED, spring(t - 0.3, 20, 0.45));
    } else if (t < tdock) {
      f.claw = 'flying';
      f.line = true;
      f.eyelet = 1.6;
      const at0 = this.miss(Math.min(tf - 1e-4, t));
      const L0 = new Vector3(), Q0 = new Quaternion();
      this.dockedClaw(at0, L0, Q0);
      const dir = aimPt.clone().sub(L0).normalize();
      const end = L0.clone().addScaledVector(dir, range);
      end.y -= 1.2;
      if (t < tsnap) {
        const u = (t - tf) / (tsnap - tf);
        const e = 1 - (1 - u) ** 1.9;
        const p = L0.clone().lerp(end, e);
        p.y += Math.sin(Math.PI * e * 0.8) * 0.7;
        const p2 = L0.clone().lerp(end, Math.min(1, e + 0.02));
        p2.y += Math.sin(Math.PI * Math.min(1, e + 0.02) * 0.8) * 0.7;
        f.clawPos.copy(p);
        this.lookQuat(p, p2, 1.3 * u, f.clawQuat);
        f.clawScale = lerp(1, 1.5, smooth(0.05, 0.85, u));
        f.talon = lerp(TALON_FOLD, TALON_OPEN, spring(t - tf - 0.02, 26, 0.45));
        f.slack = 1.04 + 0.14 * (1 - u);
        f.spool = (t - tf) * 60;
      } else if (t < trel) {
        // the line runs out: the claw jerks back a hand's width, talons slam shut, the line rings
        const k = (t - tsnap) / (trel - tsnap);
        const p = end.clone().addScaledVector(dir, -0.35 * Math.sin(Math.PI * k));
        f.clawPos.copy(p);
        this.lookQuat(p, p.clone().add(dir), 1.3, f.clawQuat);
        f.clawScale = 1.5;
        f.talon = lerp(TALON_OPEN, TALON_FOLD, smooth(0, 1, k));
        f.slack = 1.0;
        f.pulse = 1 - k;
        f.lineI = 1.8;
      } else {
        // the reel-back: dragged home under gravity, the line whipping slack behind it
        const u = (t - trel) / (tdock - trel);
        const M = this.muzzleWorld(f);
        const e = u * u * (3 - 2 * u);
        const p = end.clone().lerp(M, e);
        p.y -= Math.sin(Math.PI * u) * 2.2;
        p.x += Math.sin(Math.PI * u * 2) * 0.5;
        f.clawPos.copy(p);
        const back = M.clone().sub(p).normalize();
        this.lookQuat(p, p.clone().sub(back), 1.3 + u * 5, f.clawQuat);
        f.clawScale = lerp(1.5, 1, smooth(0.5, 1, u));
        f.talon = TALON_FOLD;
        f.slack = lerp(1.3, 1.02, u);
        f.spool = (tsnap - tf) * 60 - (t - trel) * 80;
      }
    } else {
      f.click = t < tdock + 0.1 ? (t - tdock) / 0.1 : -1;
    }
    f.focus.copy(this.ndc(f, aimPt));
    return f;
  }

  /**
   * Step the rope to time t (from its launch, or from where it was if t moved forward in the same take), anchored at
   * the muzzle and the claw's eyelet as evaluate() places them at each fixed step.
   */
  ropeAt(take: Take, t: number): Rope {
    const tf = this.fireAt(take);
    if (take !== this.ropeTake || t < this.ropeT || this.ropeT < tf) {
      this.ropeTake = take;
      this.ropeT = -1;
      this.rope.off();
    }
    if (t < tf) { this.rope.off(); this.ropeT = t; return this.rope; }
    let tt = this.ropeT;
    if (!this.rope.active) {
      const f0 = this.evaluate(take, tf + 1e-4);
      this.rope.reset(this.muzzleWorld(f0), this.eyeletWorld(f0));
      tt = tf;
    }
    const a = new Vector3(), b = new Vector3();
    while (tt + DT <= t) {
      tt += DT;
      const f = this.evaluate(take, tt);
      if (!f.line) { this.rope.off(); break; }
      this.rope.slack = f.slack;
      this.rope.step(DT, this.muzzleWorld(f, a), this.eyeletWorld(f, b));
    }
    this.ropeT = tt;
    return this.rope;
  }
}
