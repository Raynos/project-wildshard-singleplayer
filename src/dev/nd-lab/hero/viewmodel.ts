// The hero viewmodel (lab P4 "hero", E169): the Neon Jian in the right hand, the Fei Zhua on the left forearm, drawn in
// the viewmodel toon program (vm-material.ts) with one brushed ink hull, in their own scene over the world. The API is
// the clean room's weapon.ts Viewmodel (scene, camera, materials, layout, update, muzzleNdc), so it drops in there.
import {
  type BufferGeometry, Euler, Group, Matrix4, Mesh, PerspectiveCamera, Quaternion, Scene, type ShaderMaterial, type Texture, Vector2, Vector3,
} from 'three';
import { Kit } from './base/kit';
import { KitX, merge } from './kitx';
import {
  TIP_Y, buildBlade, buildBladeClip, buildClaw, buildGauntlet, buildGrip, buildGripHand, buildGuardProcedural, buildLeftFist, buildRightForearm, buildTalisman, buildTassel,
} from './weapon-parts';
import { type VmUniforms, addHullNormals, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms } from './vm-material';

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const smooth = (a: number, b: number, x: number): number => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

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

/** where the pieces sit on a portrait / landscape screen (NDC) and how far from the eye (m) */
export interface VmLayout {
  guard: Vector2;
  tip: Vector2;
  guardDepth: number;
  roll: number;
  wrist: Vector2;
  wristDepth: number;
  elbow: Vector2;
  armRoll: number;
  /** the elbow's depth as a share of the wrist's (< 1: the forearm reaches into the screen) */
  elbowDepth: number;
  fov: number;
}

export const LAYOUT_PORTRAIT: VmLayout = {
  guard: new Vector2(0.47, -0.47), tip: new Vector2(0.08, -0.03), guardDepth: 0.95, roll: 0.12,
  wrist: new Vector2(-0.6, -0.48), wristDepth: 1.1, elbow: new Vector2(-2.0, -0.9), armRoll: -0.25, elbowDepth: 1.0, fov: 70,
};
export const LAYOUT_LANDSCAPE: VmLayout = {
  guard: new Vector2(0.5, -0.52), tip: new Vector2(0.16, -0.05), guardDepth: 0.9, roll: -0.3,
  wrist: new Vector2(-0.56, -0.5), wristDepth: 0.8, elbow: new Vector2(-1.5, -0.8), armRoll: 0.4, elbowDepth: 0.8, fov: 50,
};

function withHull(g: BufferGeometry, mat: ShaderMaterial, hull: ShaderMaterial): Group {
  addHullNormals(g);
  const grp = new Group();
  const body = new Mesh(g, mat);
  const ink = new Mesh(g, hull);
  ink.renderOrder = -1;
  grp.add(ink, body);
  return grp;
}

export class Viewmodel {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(62, 1, 0.05, 50);
  readonly u: VmUniforms;
  readonly materials: ShaderMaterial[] = [];
  private readonly mat: ShaderMaterial;
  private readonly hull: ShaderMaterial;
  private readonly sword = new Group();
  private readonly guard = new Group();
  private readonly tassel = new Group();
  private readonly talisman = new Group();
  private readonly arm = new Group();
  private readonly forearm = new Group();
  private readonly clawFolded = new Group();
  private readonly fist = new Group();
  private readonly wristLocal = new Vector3(-0.032, -0.27, -0.012);
  private readonly elbow = new Vector3();
  private readonly muzzleLocal = new Vector3(0, 0.06, 0.0);
  private readonly baseSword = { pos: new Vector3(), quat: new Quaternion() };
  private readonly baseArm = { pos: new Vector3(), quat: new Quaternion() };
  private tasselAng = new Vector2();
  private tasselVel = new Vector2();
  layoutPortrait: VmLayout = LAYOUT_PORTRAIT;
  layoutLandscape: VmLayout = LAYOUT_LANDSCAPE;
  private aspect = 1;
  /** triangles in the viewmodel (for the cost report) */
  tris = 0;

  constructor(silk: Texture) {
    this.u = vmUniforms(silk, decalAtlas());
    this.mat = vmMaterial(this.u);
    this.hull = inkHullMaterial(this.u);
    this.materials.push(this.mat, this.hull);

    // the sword: blade + grip + hand in one mesh, the guard its own (swappable: procedural or a TRELLIS head)
    const k = new Kit();
    const x = new KitX();
    buildBlade(k);
    buildBladeClip(x);
    buildGrip(k, x);
    buildGripHand(x);
    this.sword.add(withHull(merge([k.build(), x.build()]), this.mat, this.hull));
    const gx = new KitX();
    buildGuardProcedural(gx);
    this.setGuard(gx.build());
    this.guard.scale.setScalar(1.3);
    this.sword.add(this.guard);
    const tx = new KitX();
    buildTassel(tx);
    this.tassel.add(withHull(tx.build(), this.mat, this.hull));
    this.tassel.position.set(-0.036, -0.03, 0.03);
    this.sword.add(this.tassel);
    const px = new KitX();
    buildTalisman(px);
    this.talisman.add(withHull(px.build(), this.mat, this.hull));
    this.talisman.position.set(0.03, -0.066, 0.036);
    this.sword.add(this.talisman);

    const ak = new Kit();
    const ax = new KitX();
    buildGauntlet(ak, ax);
    this.arm.add(withHull(merge([ak.build(), ax.build()]), this.mat, this.hull));
    const lf = new KitX();
    buildLeftFist(lf);
    this.fist.add(withHull(lf.build(), this.mat, this.hull));
    this.arm.add(this.fist);
    const cx = new KitX();
    buildClaw(cx, 0);
    this.clawFolded.add(withHull(cx.build(), this.mat, this.hull));
    this.clawFolded.position.set(0, 0.002, 0.004);
    this.arm.add(this.clawFolded);
    const fx = new KitX();
    buildRightForearm(fx);
    this.forearm.add(withHull(fx.build(), this.mat, this.hull));
    this.scene.add(this.sword, this.arm, this.forearm);
    this.scene.traverse((o) => { o.frustumCulled = false; });
    this.countTris();
  }

  /** swap the dragon-head guard (e.g. a TRELLIS head converted by glb.ts); its origin is the guard point */
  setGuard(g: BufferGeometry): void {
    this.guard.clear();
    this.guard.scale.setScalar(1);
    const grp = withHull(g, this.mat, this.hull);
    grp.traverse((o) => { o.frustumCulled = false; });
    this.guard.add(grp);
    this.countTris();
  }

  /** back to the procedural dragon head */
  resetGuard(): void {
    const gx = new KitX();
    buildGuardProcedural(gx);
    this.setGuard(gx.build());
    this.guard.scale.setScalar(1.3);
  }

  private countTris(): void {
    let n = 0;
    this.scene.traverse((o) => {
      if (o instanceof Mesh && o.material === this.mat) {
        const g = o.geometry as BufferGeometry;
        n += (g.index?.count ?? g.getAttribute('position').count) / 3;
      }
    });
    this.tris = n;
  }

  /** view-space point from NDC at a depth */
  private ndc(x: number, y: number, d: number): Vector3 {
    const ty = Math.tan((this.camera.fov * Math.PI) / 360);
    return new Vector3(x * d * ty * this.camera.aspect, y * d * ty, -d);
  }

  layout(aspect: number): void {
    this.aspect = aspect;
    const L = aspect < 1 ? this.layoutPortrait : this.layoutLandscape;
    this.camera.aspect = aspect;
    this.camera.fov = L.fov;
    this.camera.updateProjectionMatrix();
    // the jian: guard at one NDC point, tip at another; solve the tip depth so the blade keeps its length
    const G = this.ndc(L.guard.x, L.guard.y, L.guardDepth);
    let td = L.guardDepth + 0.5;
    for (let i = 0; i < 40; i++) {
      const T = this.ndc(L.tip.x, L.tip.y, td);
      td += (TIP_Y - T.distanceTo(G)) * 0.8;
    }
    const T = this.ndc(L.tip.x, L.tip.y, td);
    // an explicit frame: +y down the blade, +z (the flat with the dragon's profile) toward the eye, then `roll`
    this.baseSword.quat.copy(Viewmodel.frame(T.clone().sub(G), G.clone().negate(), L.roll));
    this.baseSword.pos.copy(G);
    // the gauntlet: wrist at one NDC point, the elbow off-frame bottom-left; its back (+z) up toward the sky, then roll
    const W = this.ndc(L.wrist.x, L.wrist.y, L.wristDepth);
    const Eb = this.ndc(L.elbow.x, L.elbow.y, L.wristDepth * L.elbowDepth);
    this.baseArm.quat.copy(Viewmodel.frame(W.clone().sub(Eb), new Vector3(0, 1, 0.35), L.armRoll));
    this.baseArm.pos.copy(W);
    this.elbow.copy(this.ndc(aspect < 1 ? 1.9 : 1.4, aspect < 1 ? -1.5 : -1.2, aspect < 1 ? 0.6 : 0.66));
  }

  /** a rotation whose +y is `dir` and whose +z leans toward `face`, turned by `roll` about +y */
  private static frame(dir: Vector3, face: Vector3, roll: number): Quaternion {
    const y = dir.clone().normalize();
    const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
    const x = new Vector3().crossVectors(y, z);
    const m = new Matrix4().makeBasis(x, y, z);
    const q = new Quaternion().setFromRotationMatrix(m);
    return new Quaternion().setFromAxisAngle(y, roll).multiply(q);
  }

  /** re-run layout with the current aspect (after a tuning change) */
  relayout(): void { this.layout(this.aspect); }

  update(dt: number, s: VmState): void {
    const bob = s.speed > 0.1 ? Math.sin(s.walk * 2) * 0.006 * s.speed : 0;
    const sway = s.speed > 0.1 ? Math.sin(s.walk) * 0.005 * s.speed : 0;
    const breathe = Math.sin(s.t * 1.7) * 0.0025;
    const lag = new Vector3(-s.lookVel.x * 0.004, s.lookVel.y * 0.004, 0);
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
    // the tassel swings as a damped pendulum driven by the hand's motion, with a slow idle drift so it never hangs dead
    const drive = new Vector2(s.lookVel.x * 0.02 + sway * 12, s.lookVel.y * 0.01 + (s.slash >= 0 ? 0.8 : 0));
    this.tasselVel.addScaledVector(drive, dt * 6).addScaledVector(this.tasselAng, -dt * 26).multiplyScalar(Math.exp(-dt * 2.2));
    this.tasselAng.addScaledVector(this.tasselVel, dt);
    const idle = new Vector2(Math.sin(s.t * 1.3) * 0.06 + Math.sin(s.t * 2.9) * 0.025, Math.sin(s.t * 1.7 + 1) * 0.04);
    // hang with gravity in view space (down = -y), swinging off the hand's motion
    const swing = new Quaternion().setFromEuler(new Euler(clamp(this.tasselAng.y + idle.y, -0.8, 0.8) + 0.15, 0.5, clamp(this.tasselAng.x + idle.x, -0.8, 0.8) + 0.1));
    this.tassel.quaternion.copy(sq.clone().invert().multiply(swing));
    const swing2 = new Quaternion().setFromEuler(new Euler(clamp(this.tasselAng.y * 0.8 - idle.x * 0.6, -0.8, 0.8) + 0.05, -0.35, clamp(this.tasselAng.x * 1.2 + idle.y, -0.8, 0.8) - 0.12));
    this.talisman.quaternion.copy(sq.clone().invert().multiply(swing2));
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
    this.clawFolded.visible = !(s.hook > 0.02 && s.hook < 0.97);
    this.fist.visible = s.hook > 0;
  }

  /** the launcher's muzzle on screen (NDC) — the filament starts there */
  muzzleNdc(): Vector2 {
    this.arm.updateMatrixWorld(true);
    const p = this.muzzleLocal.clone().applyMatrix4(this.arm.matrixWorld);
    p.project(this.camera);
    return new Vector2(p.x, p.y);
  }
}
