// The viewmodel: the Neon Jian (霓虹劍) in the right hand, the Fei Zhua (飛爪) wrist grapple on the left forearm, drawn
// in the same Jiehua program in their own scene after the world (depth cleared, so they never clip into it). The claw
// flies on a glowing mono-filament to the nearest brass dragon hook and reels back; a slash sweeps the blade.
import {
  AdditiveBlending, Euler, Group, Mesh, PerspectiveCamera, Quaternion, Scene, type ShaderMaterial, Vector2, Vector3,
} from 'three';
import { E, K, Kit, type Look } from './kit';
import { type SignAtlas, SignBuilder } from './signs';
import { jiehuaMaterial, neonMaterial, type Shared } from './style';
import { NEON, clamp, smooth } from './util';

const BRASS: Look = { wash: 0x8c6c2c, line: 1.2, gloss: true, accent: true };
const DARK_BRASS: Look = { wash: 0x54401f, line: 1.2, gloss: true, accent: true };
const LACQUER: Look = { wash: 0x17181c, kind: K.net, col: 0.012, line: 1.2, gloss: true };
const STEEL: Look = { wash: 0x4a525c, line: 1.4, gloss: true };
const GLOVE: Look = { wash: 0x24262c, line: 1.6 };
const SLEEVE: Look = { wash: 0x2d3244, kind: K.cloth, row: 0, col: 0.05, line: 1.6 };
const CUFF: Look = { wash: 0x9c2a1c, line: 1.4, accent: true };
const CARBON: Look = { wash: 0x1b1c20, kind: K.net, col: 0.008, line: 1.2 };

export const BLADE_LEN = 0.78;

function buildJian(k: Kit, glow: SignBuilder, etch: SignBuilder): void {
  // blade: a flattened diamond, pointed, dark steel with a ridge
  const hw = 0.019, th = 0.0055, L = BLADE_LEN, tipL = 0.075;
  const y0 = 0.045;
  const yT = y0 + L - tipL;
  const Lb = new Vector3(-hw, y0, 0), Rb = new Vector3(hw, y0, 0), Fb = new Vector3(0, y0, th), Bb = new Vector3(0, y0, -th);
  const Lt = new Vector3(-hw * 0.92, yT, 0), Rt = new Vector3(hw * 0.92, yT, 0), Ft = new Vector3(0, yT, th), Bt = new Vector3(0, yT, -th);
  const tip = new Vector3(0, y0 + L, 0);
  const bl: Look = { ...STEEL, edges: E.sides };
  k.quad4(Lb, Fb, Ft, Lt, hw, L, bl);
  k.quad4(Fb, Rb, Rt, Ft, hw, L, bl);
  k.quad4(Rb, Bb, Bt, Rt, hw, L, bl);
  k.quad4(Bb, Lb, Lt, Bt, hw, L, bl);
  k.tri(Lt, Ft, tip, STEEL);
  k.tri(Ft, Rt, tip, STEEL);
  k.tri(Rt, Bt, tip, STEEL);
  k.tri(Bt, Lt, tip, STEEL);
  // the neon edges: cyan-white, both sides, the only neon that moves with you
  for (const sx of [-1, 1]) {
    const a = new Vector3(sx * hw * 1.02, y0 + 0.01, 0), b = new Vector3(sx * hw * 0.94, yT, 0);
    glow.tube(a, b, new Vector3(0, 0, 1), 0.0034, NEON.jian, 7);
    glow.tube(b, tip.clone().add(new Vector3(0, 0.002, 0)), new Vector3(0, 0, 1), 0.003, NEON.jian, 7);
  }
  // etched cloud scrolls down both faces
  const center = new Vector3(0, y0 + L * 0.42, 0);
  for (const sz of [1, -1]) {
    etch.place({ at: center.clone().add(new Vector3(0, 0, sz * (th * 0.55))), normal: new Vector3(0, 0, sz), size: 0.02, spec: { text: '祥', color: '#b8c4d0', vertical: false, style: 'etch' }, gain: 0.9, fogK: 1 }, null);
  }
  // guard: a snarling brass dragon head facing the tip, the blade leaving its mouth; horns and mane swept back
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  k.limb(v(0, -0.04, 0), v(0, 0.008, 0.002), 0.021, 0.024, 9, BRASS, E.none, true);
  k.limb(v(0, 0.008, 0.002), v(0, 0.05, 0.006), 0.02, 0.011, 9, BRASS, E.none, true);
  k.limb(v(0, 0.004, -0.011), v(0, 0.042, -0.012), 0.011, 0.005, 7, DARK_BRASS, E.none, true);
  k.limb(v(0, 0.0, 0.016), v(0, 0.03, 0.019), 0.012, 0.006, 7, BRASS, E.none, true);
  for (const sx of [-1, 1]) {
    k.limb(v(sx * 0.01, 0.004, 0.02), v(sx * 0.03, -0.075, 0.042), 0.006, 0.0012, 6, BRASS, E.none, true);
    k.limb(v(sx * 0.017, 0.008, 0.0), v(sx * 0.046, -0.022, 0.004), 0.009, 0.002, 6, BRASS, E.none, true);
    k.limb(v(sx * 0.016, -0.018, -0.004), v(sx * 0.036, -0.05, -0.008), 0.008, 0.0015, 6, DARK_BRASS, E.none, true);
    k.box(sx * 0.011, 0.024, 0.016, 0.007, 0.007, 0.006, { wash: 0xff5a3a, emit: 1.6, line: 0.5, accent: true });
  }
  // grip, ferrules, pommel
  k.limb(v(0, -0.05, 0), v(0, -0.038, 0), 0.02, 0.02, 10, DARK_BRASS, E.rims, true);
  k.cyl(0, -0.2, 0, 0.0155, 0.0165, 0.152, 10, LACQUER, { edges: E.rims });
  k.cyl(0, -0.212, 0, 0.02, 0.019, 0.014, 10, BRASS);
  k.lathe(0, -0.25, 0, [[0.004, 0], [0.017, 0.008], [0.022, 0.02], [0.019, 0.031], [0.015, 0.038]], 10, BRASS, true, 0);
}

function buildTassel(k: Kit, paper: SignBuilder): void {
  k.box(0, -0.018, 0, 0.018, 0.02, 0.018, { wash: 0xb3261a, line: 1, accent: true });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = 0.006 + (i % 3) * 0.002;
    k.beam(new Vector3(Math.cos(a) * 0.004, -0.028, Math.sin(a) * 0.004), new Vector3(Math.cos(a) * r, -0.16 - (i % 4) * 0.012, Math.sin(a) * r), 0.0035, 0.0035, { wash: i % 2 === 0 ? 0xc2301f : 0x9c2418, line: 0.7, accent: true });
  }
  k.beam(new Vector3(0, -0.02, 0), new Vector3(0.018, -0.05, 0.006), 0.002, 0.002, { wash: 0x2a2c31, line: 0.5 });
  paper.place({ at: new Vector3(0.028, -0.1, 0.008), normal: new Vector3(0, 0, 1), size: 0.022, spec: { text: '鎮邪', color: '#b3261a', vertical: true, style: 'talisman' }, gain: 1.15, fogK: 1, blade: true }, null);
}

function buildHand(k: Kit): void {
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  // a gloved fist around the grip (grip axis = local y): palm behind, four curled fingers in front, the thumb over
  k.limb(v(-0.021, -0.19, -0.002), v(-0.02, -0.064, 0.0), 0.024, 0.022, 9, GLOVE, E.none, true);
  k.limb(v(0.012, -0.182, 0.012), v(0.013, -0.074, 0.013), 0.022, 0.021, 10, GLOVE, E.none, true);
  for (let i = 0; i < 4; i++) {
    const y = -0.086 - i * 0.026;
    k.limb(v(0.004, y, 0.018), v(0.024, y - 0.002, 0.004), 0.0105, 0.0095, 7, GLOVE, E.none, true);
  }
  k.limb(v(-0.024, -0.075, -0.018), v(0.01, -0.058, -0.022), 0.011, 0.0095, 7, GLOVE, E.none, true);
  // the wrist (the forearm is its own mesh, aimed at an elbow off the frame's right edge)
  k.limb(v(-0.022, -0.1, -0.006), v(-0.036, -0.16, -0.018), 0.026, 0.028, 9, GLOVE, E.none, true);
}

/** a forearm along local +y from the wrist (0) to the elbow (1): glove cuff, red cord, sleeve; scaled in y per frame */
function buildForearm(k: Kit): void {
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  k.limb(v(0, 0, 0), v(0, 0.06, 0), 0.03, 0.034, 10, GLOVE, E.none, true);
  k.limb(v(0, 0.06, 0), v(0, 0.1, 0), 0.042, 0.043, 10, CUFF, E.rims, true);
  k.limb(v(0, 0.1, 0), v(0, 1, 0), 0.048, 0.078, 12, SLEEVE, E.none, true);
}

/** the Fei Zhua on the left forearm; local +y runs from the elbow to the claw */
function buildGauntlet(k: Kit): void {
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  k.limb(v(0, -0.6, 0), v(0, -0.16, 0), 0.054, 0.045, 10, SLEEVE, E.none, true);
  k.limb(v(0, -0.215, 0), v(0, -0.2, 0), 0.05, 0.05, 10, CUFF, E.rims, true);
  k.limb(v(0, -0.24, 0), v(0, -0.228, 0), 0.052, 0.052, 10, CUFF, E.rims, true);
  // the launcher: carbon sleeve, brass bands, a nozzle, a barrel along the top
  k.limb(v(0, -0.165, 0), v(0, -0.04, 0), 0.047, 0.046, 12, CARBON, E.rims, true);
  k.limb(v(0, -0.17, 0), v(0, -0.148, 0), 0.052, 0.052, 12, BRASS, E.rims, true);
  k.limb(v(0, -0.09, 0), v(0, -0.074, 0), 0.051, 0.051, 12, BRASS, E.rims, true);
  k.limb(v(0, -0.045, 0), v(0, 0.012, 0), 0.047, 0.03, 12, DARK_BRASS, E.rims, true);
  k.limb(v(0, -0.14, 0.047), v(0, 0.01, 0.043), 0.008, 0.007, 8, DARK_BRASS, E.rims, true);
  k.boxAxes(v(0, -0.115, 0.05), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), 0.024, 0.032, 0.004, { ...BRASS, kind: K.panel });
  k.limb(v(0.046, -0.13, 0), v(0.046, -0.05, 0), 0.008, 0.008, 6, DARK_BRASS, E.rims, true);
  for (const yy of [-0.185, -0.176, -0.167]) k.limb(v(0, yy, 0), v(0, yy + 0.005, 0), 0.056, 0.056, 12, { wash: 0xb3261a, line: 0.8, accent: true }, E.rims, true);
  // a small brass dragon crest riding the plate
  k.limb(v(0, -0.09, 0.056), v(0, -0.055, 0.064), 0.009, 0.005, 6, BRASS, E.none, true);
  for (const sx of [-1, 1]) k.limb(v(sx * 0.006, -0.085, 0.062), v(sx * 0.018, -0.115, 0.072), 0.004, 0.001, 5, BRASS, E.none, true);
  // the glove's fist just past the launcher
  k.limb(v(0, -0.01, -0.046), v(0, 0.045, -0.044), 0.027, 0.023, 9, GLOVE, E.none, true);
  k.limb(v(-0.02, 0.04, -0.054), v(0.02, 0.04, -0.054), 0.012, 0.012, 7, GLOVE, E.none, true);
}

/** the three-talon claw (folded when `spread` = 0); local +y is its flight axis, hub at the origin */
export function buildClaw(k: Kit, spread: number): void {
  k.cyl(0, -0.02, 0, 0.022, 0.03, 0.04, 10, BRASS);
  k.lathe(0, 0.02, 0, [[0.03, 0], [0.026, 0.012], [0.012, 0.022], [0.002, 0.026]], 10, BRASS, true, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const p0 = dir.clone().multiplyScalar(0.022).setY(0.0);
    const p1 = dir.clone().multiplyScalar(0.032 + spread * 0.05).setY(0.055);
    const p2 = dir.clone().multiplyScalar(0.03 + spread * 0.075).setY(0.115);
    const p3 = dir.clone().multiplyScalar(0.006 + spread * 0.05).setY(0.15);
    k.limb(p0, p1, 0.009, 0.008, 5, BRASS, E.none, true);
    k.limb(p1, p2, 0.008, 0.006, 5, BRASS, E.none, true);
    k.limb(p2, p3, 0.006, 0.0008, 5, BRASS, E.none, true);
    k.box(p1.x, p1.y - 0.004, p1.z, 0.014, 0.014, 0.014, DARK_BRASS);
  }
}

export interface VmState {
  t: number;
  walk: number;
  speed: number;
  lookVel: Vector2;
  /** slash progress 0..1, or < 0 when idle */
  slash: number;
  heavy: boolean;
  /** 0 idle, else the hook phase 0..1 */
  hook: number;
  /** where the hook target sits on screen (NDC), for the arm to aim */
  aimNdc: Vector2 | null;
}

export class Viewmodel {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(62, 1, 0.1, 1200);
  private readonly sword = new Group();
  private readonly tassel = new Group();
  private readonly arm = new Group();
  private readonly forearm = new Group();
  private readonly wristLocal = new Vector3(-0.036, -0.16, -0.018);
  private readonly elbow = new Vector3();
  private readonly clawFolded = new Group();
  readonly materials: ShaderMaterial[] = [];
  private readonly muzzleLocal = new Vector3(0, 0.035, 0.05);
  private readonly baseSword = { pos: new Vector3(), quat: new Quaternion() };
  private readonly baseArm = { pos: new Vector3(), quat: new Quaternion() };
  private tasselAng = new Vector2();
  private tasselVel = new Vector2();

  constructor(shared: Shared, atlas: SignAtlas) {
    const mat = jiehuaMaterial(shared, { viewmodel: true });
    const neon = neonMaterial(shared, atlas.textures, { viewmodel: true });
    const add = neonMaterial(shared, atlas.textures, { viewmodel: true });
    add.transparent = true;
    add.blending = AdditiveBlending;
    add.depthWrite = false;
    this.materials.push(mat, neon, add);

    const sk = new Kit();
    const glow = new SignBuilder(atlas);
    const etch = new SignBuilder(atlas);
    buildJian(sk, glow, etch);
    buildHand(sk);
    this.sword.add(new Mesh(sk.build(), mat), new Mesh(glow.build(), neon), new Mesh(etch.build(), add));
    const tk = new Kit();
    const paper = new SignBuilder(atlas);
    buildTassel(tk, paper);
    this.tassel.add(new Mesh(tk.build(), mat), new Mesh(paper.build(), neon));
    this.tassel.position.set(0, -0.28, 0);
    this.sword.add(this.tassel);

    const ak = new Kit();
    buildGauntlet(ak);
    this.arm.add(new Mesh(ak.build(), mat));
    const ck = new Kit();
    buildClaw(ck, 0.12);
    const muzzleGlow = new SignBuilder(atlas);
    muzzleGlow.light(new Vector3(0, 0.0, 0.0), new Vector3(1, 0, 0), new Vector3(0, 0, 1), 0.012, 0.012, NEON.cyan, 6);
    this.clawFolded.add(new Mesh(ck.build(), mat), new Mesh(muzzleGlow.build(), neon));
    this.clawFolded.position.set(0, 0.03, 0.006);
    this.arm.add(this.clawFolded);
    const fk = new Kit();
    buildForearm(fk);
    this.forearm.add(new Mesh(fk.build(), mat));
    this.scene.add(this.sword, this.arm, this.forearm);
    for (const m of [...this.sword.children, ...this.arm.children]) m.frustumCulled = false;
    this.scene.traverse((o) => { o.frustumCulled = false; });
  }

  /** view-space point from NDC at a depth */
  private ndc(x: number, y: number, d: number): Vector3 {
    const ty = Math.tan((this.camera.fov * Math.PI) / 360);
    return new Vector3(x * d * ty * this.camera.aspect, y * d * ty, -d);
  }

  layout(aspect: number): void {
    const portrait = aspect < 1;
    this.camera.aspect = aspect;
    this.camera.fov = portrait ? 70 : 50;
    this.camera.updateProjectionMatrix();
    // the jian: guard at one NDC point, tip at another; solve the tip depth so the blade keeps its length
    const guardN = portrait ? new Vector2(0.54, -0.46) : new Vector2(0.5, -0.52);
    const tipN = portrait ? new Vector2(0.05, -0.04) : new Vector2(0.16, -0.05);
    const gd = portrait ? 0.86 : 0.86;
    const G = this.ndc(guardN.x, guardN.y, gd);
    let td = gd + 0.5;
    for (let i = 0; i < 40; i++) {
      const T = this.ndc(tipN.x, tipN.y, td);
      const len = T.distanceTo(G);
      td += (BLADE_LEN - len) * 0.8;
    }
    const T = this.ndc(tipN.x, tipN.y, td);
    const D = T.clone().sub(G).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), D);
    // roll so the blade's flat face turns up toward the eye
    const roll = new Quaternion().setFromAxisAngle(D, portrait ? -0.35 : -0.3);
    this.baseSword.quat.copy(roll.multiply(q));
    this.baseSword.pos.copy(G);
    // the gauntlet: wrist at one NDC point, the elbow out of frame at the bottom-left
    const wristN = portrait ? new Vector2(-0.56, -0.42) : new Vector2(-0.56, -0.5);
    const W = this.ndc(wristN.x, wristN.y, portrait ? 0.78 : 0.8);
    const Eb = this.ndc(portrait ? -1.9 : -1.5, portrait ? -0.72 : -0.8, 0.6);
    const Da = W.clone().sub(Eb).normalize();
    const qa = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), Da);
    const rolla = new Quaternion().setFromAxisAngle(Da, 0.5);
    this.baseArm.quat.copy(rolla.multiply(qa));
    this.baseArm.pos.copy(W);
    this.elbow.copy(this.ndc(portrait ? 1.5 : 1.25, portrait ? -1.05 : -1.1, portrait ? 0.62 : 0.66));
  }

  update(dt: number, s: VmState): void {
    const bob = s.speed > 0.1 ? Math.sin(s.walk * 2) * 0.006 * s.speed : 0;
    const sway = s.speed > 0.1 ? Math.sin(s.walk) * 0.005 * s.speed : 0;
    const breathe = Math.sin(s.t * 1.7) * 0.0025;
    const lag = new Vector3(-s.lookVel.x * 0.004, s.lookVel.y * 0.004, 0);
    // sword
    const sp = this.baseSword.pos.clone().add(new Vector3(sway, bob + breathe, 0)).add(lag);
    const sq = this.baseSword.quat.clone();
    if (s.slash >= 0) {
      const t = s.slash;
      const wind = smooth(0, 0.22, t) * (1 - smooth(0.22, 0.5, t));
      const strike = smooth(0.18, 0.55, t) * (1 - smooth(0.7, 1.0, t));
      const k = s.heavy ? 1.35 : 1;
      const qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (wind * 0.5 - strike * 1.9) * k);
      const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (wind * 0.45 - strike * 0.55) * k);
      const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), strike * 0.7 * k);
      sq.premultiply(qx).premultiply(qy).premultiply(qz);
      sp.add(new Vector3(-strike * 0.14 * k + wind * 0.03, wind * 0.05 - strike * 0.02, -strike * 0.06));
    }
    this.sword.position.copy(sp);
    this.sword.quaternion.copy(sq);
    // the right forearm: from the wrist on the grip to the elbow out of frame
    this.sword.updateMatrix();
    const wrist = this.wristLocal.clone().applyMatrix4(this.sword.matrix);
    const el = this.elbow.clone().add(new Vector3(sway * 0.6, bob * 0.6, 0));
    const fd = el.clone().sub(wrist);
    this.forearm.position.copy(wrist);
    this.forearm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), fd.clone().normalize());
    this.forearm.scale.set(1, fd.length(), 1);
    // the tassel swings as a damped pendulum driven by the hand's motion
    const drive = new Vector2(s.lookVel.x * 0.02 + sway * 12, s.lookVel.y * 0.01 + (s.slash >= 0 ? 0.8 : 0));
    this.tasselVel.addScaledVector(drive, dt * 6).addScaledVector(this.tasselAng, -dt * 26).multiplyScalar(Math.exp(-dt * 2.2));
    this.tasselAng.addScaledVector(this.tasselVel, dt);
    this.tasselAng.x += Math.sin(s.t * 1.3) * 0.0006;
    // the tassel hangs with gravity (view-space down, the eye level), swinging off the hand's motion
    const swing = new Quaternion().setFromEuler(new Euler(clamp(this.tasselAng.y, -0.8, 0.8) + 0.25, 0, clamp(this.tasselAng.x, -0.8, 0.8) + 0.12));
    this.tassel.quaternion.copy(sq.clone().invert().multiply(swing));
    // gauntlet: raise and aim while hooking
    const ap = this.baseArm.pos.clone().add(new Vector3(-sway * 0.8, bob * 0.8 + breathe * 0.7, 0)).add(lag);
    const aq = this.baseArm.quat.clone();
    const aimW = s.hook > 0 ? smooth(0, 0.12, s.hook) * (1 - smooth(0.8, 1, s.hook)) : 0;
    if (aimW > 0 && s.aimNdc !== null) {
      const target = this.ndc(s.aimNdc.x, s.aimNdc.y, 2.0);
      const want = target.clone().sub(ap).normalize();
      const qa = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), want);
      aq.slerp(qa, aimW * 0.85);
      ap.add(new Vector3(0.05, 0.06, -0.04).multiplyScalar(aimW));
    }
    this.arm.position.copy(ap);
    this.arm.quaternion.copy(aq);
    // the folded claw leaves the launcher while it flies
    this.clawFolded.visible = !(s.hook > 0.02 && s.hook < 0.97);
  }

  /** the launcher's muzzle on screen (NDC) — the filament starts there */
  muzzleNdc(): Vector2 {
    this.arm.updateMatrixWorld(true);
    const p = this.muzzleLocal.clone().add(new Vector3(0, 0.08, -0.05)).applyMatrix4(this.arm.matrixWorld);
    p.project(this.camera);
    return new Vector2(p.x, p.y);
  }
}

