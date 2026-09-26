// Copied from the viewmodel lab (src/dev/nd-lab/viewmodel/viewmodel.ts, round-9-lab-viewmodel) into the clean room.
// The first-person viewmodel, remastered (lab P8 "viewmodel", E169): the Neon Jian in the gloved right hand, the Fei
// Zhua gauntlet on the cloth-wrapped left forearm, both sleeves, in their own scene over the world. The API is the clean
// room's (src/dev/nine-dragon/hero/viewmodel.ts: scene, camera, materials, u, layout, update, muzzleNdc) plus the moves
// (`play('light' | 'heavy' | 'parry' | 'draw' | 'sheathe')`) and `load()` for the GLBs.
//
// Pieces (JIAN-local = the grip axis +y, the blade up +y, the flats ±z; see SPEC in ./blender/):
//   sword   blade + neon edges + grip cord wrap + collar + ring + pommel + blade clip (jian.ts, one mesh) · the dragon
//           guard (guard.glb, vertex maps) · the heat-shimmer halo · the tassel (verlet, cloth.ts) · the talisman
//           (verlet sheet) · the gloved right hand (hand-r.glb, texture maps)
//   armR    the right sleeve (arm-r.glb) from the hand's wrist to an elbow that follows the hand at 45 %
//   left    the Fei Zhua (gauntlet.glb; its `claw` node hides while the grapple flies) · the left fist (fist-l.glb)
//   trail   the 飞白 slash ribbon (trail.ts)
// Motion: breathing, a figure-8 walk bob, look lag, and keyframed moves (Catmull-Rom on offsets + rotation deltas about
// the hand, the arm pivoting from an off-screen shoulder), the cloth reacting through its pinned pivots.
import {
  type BufferAttribute, BufferGeometry, DoubleSide, Group, Matrix4, Mesh, PerspectiveCamera, Quaternion, Scene, type ShaderMaterial, type Texture, Vector2, Vector3,
} from 'three';
import { type Asset, loadAsset } from './assets';
import { Talisman, Tassel } from './cloth';
import { CLS, Geo, v3 } from './geo';
import { JIAN, TIP_Y, buildBlade, buildBladeClip, buildGrip, buildHalo } from './jian';
import { type VmUniforms, addHullNormals, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms, weaveTexture } from './materials';
import { Trail, type TrailLook } from './trail';

export interface VmState {
  t: number;
  walk: number;
  speed: number;
  lookVel: Vector2;
  /** 0 idle, else the hook phase 0..1 (the grapple lab owns the flight; here the claw just hides) */
  hook: number;
  aimNdc: Vector2 | null;
}

export type MoveName = 'light' | 'heavy' | 'parry' | 'draw' | 'sheathe';

/**
 * A key: time (s), the hand's offset from its rest point (view m), the blade's direction in view space (null = the rest
 * direction), and its roll about its own axis (rad; 0 = the flat toward the eye). The sword pivots at the HAND (the grip
 * centre), not at the guard, and the right elbow follows the hand at 45 % — the arm swings from the shoulder.
 */
type V3 = readonly [number, number, number];
interface Key { t: number; o: V3; d: V3 | null; roll: number }
interface Move { keys: readonly Key[]; trail: readonly [number, number] | null; life: number; left: V3 }

const k = (t: number, o: V3, d: V3 | null, roll = 0): Key => ({ t, o, d, roll });
const REST_KEY = (t: number): Key => k(t, [0, 0, 0], null);

/** the moves, tuned on the portrait layout (the blade from the lower right toward the centre, pointing (−0.13, 0.35, −0.93)) */
export const MOVES: Readonly<Record<MoveName, Move>> = {
  // light: cock to the upper right, cut right → left across the frame, follow through low left, recover
  light: {
    keys: [REST_KEY(0), k(0.1, [0.02, 0.12, -0.02], [0.3, 0.85, -0.43], 0.35), k(0.19, [-0.04, 0.03, -0.09], [-0.55, 0.35, -0.76], -0.1),
      k(0.27, [-0.16, -0.07, -0.05], [-0.85, -0.25, -0.46], -0.45), k(0.4, [-0.18, -0.1, -0.02], [-0.72, -0.45, -0.52], -0.4), REST_KEY(0.72)],
    trail: [0.12, 0.34], life: 0.3, left: [-0.02, -0.02, 0.02],
  },
  // heavy: the blade raised high over the right shoulder (the charge), a big diagonal chop to the lower left, a heavy
  // follow-through, a slow recovery
  heavy: {
    keys: [REST_KEY(0), k(0.26, [-0.04, 0.16, 0.02], [-0.32, 0.9, 0.28], 0.5), k(0.4, [-0.035, 0.17, 0.025], [-0.34, 0.9, 0.26], 0.55),
      k(0.49, [0.0, 0.05, -0.12], [-0.35, 0.3, -0.89], 0.0), k(0.57, [-0.14, -0.14, -0.08], [-0.6, -0.5, -0.62], -0.4),
      k(0.74, [-0.16, -0.18, -0.03], [-0.55, -0.65, -0.52], -0.4), REST_KEY(1.15)],
    trail: [0.4, 0.66], life: 0.42, left: [-0.04, -0.05, 0.03],
  },
  // parry: snap the blade upright across the body (a block, flat to the enemy), a flick outward to the right, back
  parry: {
    keys: [REST_KEY(0), k(0.07, [-0.17, 0.06, -0.05], [-0.12, 0.97, -0.2], 1.4), k(0.17, [-0.17, 0.07, -0.055], [-0.1, 0.97, -0.2], 1.45),
      k(0.24, [-0.06, 0.08, -0.06], [0.42, 0.82, -0.38], 0.6), REST_KEY(0.5)],
    trail: [0.16, 0.26], life: 0.2, left: [0.01, 0.02, 0.0],
  },
  // draw: up from the lower right out of frame, a turn of the wrist (the flourish), settle
  draw: {
    keys: [k(0, [0.22, -0.45, 0.12], [0.3, 0.55, -0.78], 2.2), k(0.2, [0.1, -0.14, 0.04], [0.1, 0.5, -0.86], 1.4), k(0.36, [0.0, 0.02, -0.01], [-0.18, 0.4, -0.9], -0.3),
      k(0.5, [0.0, 0.0, 0.0], null, 0.08), REST_KEY(0.64)],
    trail: [0.16, 0.38], life: 0.25, left: [0.0, 0.0, 0.0],
  },
  sheathe: {
    keys: [REST_KEY(0), k(0.14, [0.01, 0.03, 0.0], [-0.1, 0.42, -0.9], -0.4), k(0.3, [0.1, -0.16, 0.05], [0.15, 0.5, -0.85], 1.0), k(0.5, [0.22, -0.45, 0.12], [0.3, 0.55, -0.78], 2.2)],
    trail: null, life: 0.2, left: [0.0, 0.0, 0.0],
  },
};

/** where the pieces sit on a portrait / landscape screen (NDC) and how far from the eye (m) */
export interface VmLayout {
  guard: Vector2;
  tip: Vector2;
  guardDepth: number;
  /** turn of the blade about its own axis (0 = the flat faces the eye) */
  roll: number;
  wrist: Vector2;
  wristDepth: number;
  elbow: Vector2;
  armRoll: number;
  elbowDepth: number;
  fov: number;
}

export const LAYOUT_PORTRAIT: VmLayout = {
  guard: new Vector2(0.47, -0.47), tip: new Vector2(0.08, -0.03), guardDepth: 0.95, roll: 0.12,
  // the Fei Zhua from the lower-left corner at ~35°, foreshortened so the wraps, the cord and the drum all show (l06 a)
  wrist: new Vector2(-0.3, -0.42), wristDepth: 1.15, elbow: new Vector2(-1.7, -1.1), armRoll: -0.3, elbowDepth: 0.75,
  fov: 70,
};
export const LAYOUT_LANDSCAPE: VmLayout = {
  guard: new Vector2(0.5, -0.52), tip: new Vector2(0.16, -0.05), guardDepth: 0.9, roll: -0.3,
  wrist: new Vector2(-0.56, -0.5), wristDepth: 0.8, elbow: new Vector2(-1.5, -0.8), armRoll: 0.4, elbowDepth: 0.8,
  fov: 50,
};

/** attachment points from the Blender forks (SPEC.md); tuned in the lab */
export const ATTACH = {
  /** arm-r's origin in JIAN-local (3.5 cm inside the glove's cuff), its +z (the back of the forearm), and d, the
   *  direction from the wrist to the elbow (arm-r's −y) — the hand fork's frame (blender/hand.py) */
  armR: new Vector3(0.0419, -0.2219, -0.0842),
  armRZ: new Vector3(-0.8, 0, -0.6),
  armRDir: new Vector3(0.453, -0.655, -0.605).normalize(),
  /** the forearm's length to the elbow (m) and how much of the hand's move offset the elbow follows */
  armRLen: 0.34,
  elbowFollow: 0.45,
  /** the tassel / talisman pivots under the guard (JIAN-local) */
  tassel: new Vector3(-0.026, -0.048, 0.014),
  talisman: new Vector3(0.05, -0.036, 0.022),
  /** the left fist in GAUNTLET-local */
  fist: new Vector3(0, -0.085, -0.036),
  /** the grapple muzzle in GAUNTLET-local */
  muzzle: new Vector3(0, 0.006, 0),
};

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);

function hulled(g: BufferGeometry, mat: ShaderMaterial, hull: ShaderMaterial, dynamic = false): Group {
  if (!dynamic) addHullNormals(g);
  const grp = new Group();
  const body = new Mesh(g, mat);
  const ink = new Mesh(g, hull);
  ink.renderOrder = -1;
  body.frustumCulled = false;
  ink.frustumCulled = false;
  grp.add(ink, body);
  return grp;
}

/** Catmull-Rom of a key channel at time t */
function sampleKeys(keys: readonly Key[], t: number, pick: (k: Key) => number): number {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && (keys[i + 1]?.t ?? 0) < t) i++;
  const k1 = keys[i], k2 = keys[Math.min(n - 1, i + 1)];
  if (k1 === undefined || k2 === undefined) return 0;
  const k0 = keys[Math.max(0, i - 1)] ?? k1, k3 = keys[Math.min(n - 1, i + 2)] ?? k2;
  const u = clamp((t - k1.t) / Math.max(1e-5, k2.t - k1.t), 0, 1);
  const p0 = pick(k0), p1 = pick(k1), p2 = pick(k2), p3 = pick(k3);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

export class Viewmodel {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(62, 1, 0.03, 50);
  readonly u: VmUniforms;
  readonly materials: ShaderMaterial[] = [];
  readonly sword = new Group();
  readonly armR = new Group();
  readonly left = new Group();
  readonly trail = new Trail();
  readonly halo: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly matCloth: ShaderMaterial;
  private readonly hull: ShaderMaterial;
  private readonly hullThin: ShaderMaterial;
  private readonly guard = new Group();
  private readonly hand = new Group();
  private readonly claw = new Group();
  private readonly fist = new Group();
  private readonly knot: Group;
  private readonly tassel = new Tassel();
  private readonly talisman = new Talisman();
  private readonly baseSword = { pos: new Vector3(), quat: new Quaternion() };
  private readonly baseArm = { pos: new Vector3(), quat: new Quaternion() };
  private move: MoveName | null = null;
  private moveT = 0;
  private sheathed = false;
  private trailOn = false;
  layoutPortrait: VmLayout = LAYOUT_PORTRAIT;
  layoutLandscape: VmLayout = LAYOUT_LANDSCAPE;
  private aspect = 1;
  /** gravity in the vm scene (view) space; the lab tilts it by the camera pitch */
  readonly gravity = new Vector3(0, -9.8, 0);
  breeze = 0.6;
  tris = 0;
  readonly loaded: string[] = [];

  constructor(silk: Texture = weaveTexture()) {
    this.u = vmUniforms(silk, decalAtlas());
    this.mat = vmMaterial(this.u);
    this.matCloth = vmMaterial(this.u);
    this.matCloth.side = DoubleSide;
    this.hull = inkHullMaterial(this.u, 1);
    this.hullThin = inkHullMaterial(this.u, 0.55);
    this.materials.push(this.mat, this.matCloth, this.hull, this.hullThin);

    // the sword: blade + grip + clip in one mesh
    const g = new Geo();
    buildBlade(g);
    buildGrip(g);
    buildBladeClip(g);
    this.sword.add(hulled(g.build(), this.mat, this.hull));
    this.sword.add(this.guard, this.hand);
    const halo = buildHalo();
    this.halo = new Mesh(halo.geo, halo.mat);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 4;
    this.sword.add(this.halo);
    this.materials.push(halo.mat);
    // the tassel's knot + cap (rigid, rides the cord's end), the strands and the talisman (dynamic, scene space)
    const kx = new Geo();
    kx.ellipsoid(v3(0, 0.006, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.0085, 0.0095, 0.0085, { cls: CLS.silk }, (d) => 1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.z * 9), 14);
    kx.lathe(0, -0.018, 0, [[0.0052, 0], [0.0098, 0.004], [0.0105, 0.009], [0.0088, 0.013], [0.006, 0.016]], 16, { cls: CLS.brass, line: 1, edges: 4 | 8 });
    this.knot = hulled(kx.build(), this.mat, this.hullThin);
    this.scene.add(this.knot);
    this.scene.add(hulled(this.tassel.geo, this.mat, this.hullThin, true));
    this.scene.add(hulled(this.talisman.geo, this.matCloth, this.hullThin, true));
    this.scene.add(hulled(this.talisman.cordGeo, this.mat, this.hullThin, true));
    this.left.add(this.claw, this.fist);
    this.scene.add(this.sword, this.armR, this.left, this.trail.mesh);
    this.materials.push(this.trail.mesh.material as ShaderMaterial);
    this.scene.traverse((o) => { o.frustumCulled = false; });
    this.countTris();
  }

  /** load the GLBs that exist (each is optional: a missing one leaves its slot empty) */
  async load(): Promise<void> {
    const put = (slot: Group, a: Asset, part: string, hull: ShaderMaterial): void => {
      const geo = a.parts.get(part);
      if (geo === undefined) return;
      const mat = a.maps === null ? this.mat : vmMaterial(this.u, a.maps, a.nrm);
      if (mat !== this.mat) this.materials.push(mat);
      slot.clear();
      slot.add(hulled(geo, mat, hull));
    };
    const tryLoad = async (name: string, split: readonly string[], use: (a: Asset) => void): Promise<void> => {
      try {
        const a = await loadAsset(name, split);
        use(a);
        this.loaded.push(`${name} ${Math.round(a.tris)} tris${a.maps === null ? '' : ' +maps'}${a.nrm === null ? '' : ' +nrm'}`);
      } catch (e: unknown) {
        this.loaded.push(`${name} missing`);
        console.info(`vm lab: ${name}.glb not loaded`, e);
      }
    };
    await Promise.all([
      tryLoad('guard', [], (a) => { put(this.guard, a, 'main', this.hull); }),
      tryLoad('hand-r', [], (a) => { put(this.hand, a, 'main', this.hull); }),
      tryLoad('arm-r', [], (a) => { put(this.armR, a, 'main', this.hull); }),
      tryLoad('gauntlet', ['claw'], (a) => {
        const main = new Group();
        put(main, a, 'main', this.hull);
        put(this.claw, a, 'claw', this.hull);
        const old = this.left.children.filter((c) => c !== this.claw && c !== this.fist);
        for (const o of old) this.left.remove(o);
        this.left.add(main);
      }),
      tryLoad('fist-l', [], (a) => { put(this.fist, a, 'main', this.hull); this.fist.position.copy(ATTACH.fist); }),
    ]);
    this.scene.traverse((o) => { o.frustumCulled = false; });
    this.countTris();
  }

  private countTris(): void {
    let n = 0;
    this.scene.traverse((o) => {
      if (o instanceof Mesh && o.renderOrder !== -1 && o.geometry instanceof BufferGeometry) {
        const g = o.geometry;
        const pos = g.getAttribute('position') as BufferAttribute;
        n += (g.index?.count ?? pos.count) / 3;
      }
    });
    this.tris = n;
  }

  private ndc(x: number, y: number, d: number): Vector3 {
    const ty = Math.tan((this.camera.fov * Math.PI) / 360);
    return new Vector3(x * d * ty * this.camera.aspect, y * d * ty, -d);
  }

  /** a rotation whose +y is `dir` and whose +z leans toward `face`, turned by `roll` about +y */
  private static frame(dir: Vector3, face: Vector3, roll: number): Quaternion {
    const y = dir.clone().normalize();
    const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
    const x = new Vector3().crossVectors(y, z);
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
    return new Quaternion().setFromAxisAngle(y, roll).multiply(q);
  }

  layout(aspect: number): void {
    this.aspect = aspect;
    const L = aspect < 1 ? this.layoutPortrait : this.layoutLandscape;
    this.camera.aspect = aspect;
    this.camera.fov = L.fov;
    this.camera.updateProjectionMatrix();
    const G = this.ndc(L.guard.x, L.guard.y, L.guardDepth);
    let td = L.guardDepth + 0.5;
    for (let i = 0; i < 40; i++) {
      const T = this.ndc(L.tip.x, L.tip.y, td);
      td += (TIP_Y - T.distanceTo(G)) * 0.8;
    }
    const T = this.ndc(L.tip.x, L.tip.y, td);
    this.baseSword.quat.copy(Viewmodel.frame(T.clone().sub(G), G.clone().negate(), L.roll));
    this.baseSword.pos.copy(G);
    const W = this.ndc(L.wrist.x, L.wrist.y, L.wristDepth);
    const Eb = this.ndc(L.elbow.x, L.elbow.y, L.wristDepth * L.elbowDepth);
    this.baseArm.quat.copy(Viewmodel.frame(W.clone().sub(Eb), new Vector3(0, 1, 0.35), L.armRoll));
    this.baseArm.pos.copy(W);
  }

  relayout(): void { this.layout(this.aspect); }

  /** start a move (a move in progress is replaced) */
  play(name: MoveName): void {
    if (name === 'draw') this.sheathed = false;
    this.move = name;
    this.moveT = 0;
    this.trailOn = false;
    this.trail.begin(MOVES[name].life, Math.random() * 100);
  }

  setTrailLook(look: TrailLook): void { this.trail.setLook(look); }

  /** the neon edge's emission (HDR; the bloom threshold is 1): scales the glow class's palette entry */
  setEmit(gain: number): void {
    const c = this.u.uPal.value[CLS.glow];
    if (c !== undefined) c.setHex(0xd9fbff).multiplyScalar(gain / JIAN.emit);
  }

  /** freeze a move at time t (captures): sets the pose without advancing the cloth's clock beyond `dt` */
  pose(name: MoveName | null, t: number): void {
    this.move = name;
    this.moveT = t;
  }

  get moving(): boolean { return this.move !== null; }

  /** the hand's grip point in JIAN-local (the pivot of every move) */
  static readonly HAND = new Vector3(0, -0.165, 0);

  private swordPose(s: VmState, outPos: Vector3, outQuat: Quaternion): { o: Vector3 } {
    const bob = s.speed > 0.1 ? Math.sin(s.walk * 2) * 0.006 * s.speed : 0;
    const sway = s.speed > 0.1 ? Math.sin(s.walk) * 0.007 * s.speed : 0;
    const breathe = Math.sin(s.t * 1.6) * 0.0028 + Math.sin(s.t * 0.37) * 0.0012;
    const o = new Vector3(sway - s.lookVel.x * 0.004, bob + breathe + s.lookVel.y * 0.004, 0);
    // small idle / walk / look-lag turns about the hand (view axes)
    const r = new Vector3(Math.sin(s.t * 1.6 + 0.6) * 0.012 + s.lookVel.y * 0.01, -s.lookVel.x * 0.012, Math.sin(s.t * 0.8) * 0.01 + sway * 2.5);
    const restQ = this.baseSword.quat;
    const restDir = new Vector3(0, 1, 0).applyQuaternion(restQ);
    const restHand = Viewmodel.HAND.clone().applyQuaternion(restQ).add(this.baseSword.pos);
    let dir = restDir.clone();
    let roll = this.rollNow();
    const keys = this.move !== null ? MOVES[this.move].keys : this.sheathed ? MOVES.sheathe.keys.slice(-1) : null;
    if (keys !== null) {
      const t = this.move !== null ? this.moveT : 0;
      const pick = (q: Key, i: number): number => (q.d ?? [restDir.x, restDir.y, restDir.z])[i] ?? 0;
      o.x += sampleKeys(keys, t, (q) => q.o[0]);
      o.y += sampleKeys(keys, t, (q) => q.o[1]);
      o.z += sampleKeys(keys, t, (q) => q.o[2]);
      dir = new Vector3(sampleKeys(keys, t, (q) => pick(q, 0)), sampleKeys(keys, t, (q) => pick(q, 1)), sampleKeys(keys, t, (q) => pick(q, 2))).normalize();
      roll += sampleKeys(keys, t, (q) => q.roll);
    }
    const hand = restHand.clone().add(o);
    const q = Viewmodel.frame(dir, hand.clone().negate(), roll);
    q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), r.z)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), r.y))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), r.x)));
    outQuat.copy(q);
    outPos.copy(hand).sub(Viewmodel.HAND.clone().applyQuaternion(q));
    return { o };
  }

  /** the sword's position in its rest pose (the hand at its rest point) */
  private restSwordPos(restQ: Quaternion): Vector3 {
    const restHand = Viewmodel.HAND.clone().applyQuaternion(restQ).add(this.baseSword.pos);
    return restHand.sub(Viewmodel.HAND.clone().applyQuaternion(restQ));
  }

  private rollNow(): number {
    return this.aspect < 1 ? this.layoutPortrait.roll : this.layoutLandscape.roll;
  }

  update(dt: number, s: VmState): void {
    this.u.uTime.value = s.t;
    const haloT = this.halo.material as ShaderMaterial;
    const ht = haloT.uniforms['uTime'];
    if (ht !== undefined) ht.value = s.t;
    if (this.move !== null) {
      this.moveT += dt;
      const m = MOVES[this.move];
      const end = m.keys[m.keys.length - 1]?.t ?? 0;
      if (this.moveT >= end) {
        if (this.move === 'sheathe') this.sheathed = true;
        this.move = null;
      }
    }
    const sp = new Vector3(), sq = new Quaternion();
    const { o } = this.swordPose(s, sp, sq);
    this.sword.position.copy(sp);
    this.sword.quaternion.copy(sq);
    this.sword.updateMatrixWorld(true);
    // trail: sample the blade through the move's active window
    const m = this.move === null ? null : MOVES[this.move];
    const active = m !== null && m.trail !== null && this.moveT >= m.trail[0] && this.moveT <= m.trail[1];
    if (active) {
      const inner = v3(0, JIAN.root + JIAN.len * 0.34, 0).applyMatrix4(this.sword.matrixWorld);
      const tip = v3(0, TIP_Y + 0.01, 0).applyMatrix4(this.sword.matrixWorld);
      this.trail.sample(inner, tip);
      this.trailOn = true;
    }
    this.trail.update(dt);
    // the right forearm: from the hand's wrist to an elbow that follows the hand at 45 %
    // the right sleeve: from the glove's cuff to an elbow that sits along the cuff's axis at rest and follows the hand's
    // move offset at 45 % (the arm swings from the shoulder); its roll keeps the glove's back-of-forearm axis
    const wrist = ATTACH.armR.clone().applyMatrix4(this.sword.matrixWorld);
    const restQ = this.baseSword.quat;
    const restWrist = ATTACH.armR.clone().applyQuaternion(restQ).add(this.restSwordPos(restQ));
    const el = restWrist.clone().addScaledVector(ATTACH.armRDir.clone().applyQuaternion(restQ), ATTACH.armRLen).addScaledVector(o, ATTACH.elbowFollow);
    const toWrist = wrist.clone().sub(el);
    this.armR.position.copy(wrist);
    this.armR.quaternion.copy(Viewmodel.frame(toWrist, ATTACH.armRZ.clone().applyQuaternion(sq), 0));
    // the neon spill: the blade's lower 60 %
    this.u.uBladeA.value.copy(v3(0, JIAN.root, 0).applyMatrix4(this.sword.matrixWorld));
    this.u.uBladeB.value.copy(v3(0, JIAN.root + JIAN.len * 0.6, 0).applyMatrix4(this.sword.matrixWorld));
    // cloth: pivots ride the sword
    const tp = ATTACH.tassel.clone().applyMatrix4(this.sword.matrixWorld);
    const lp = ATTACH.talisman.clone().applyMatrix4(this.sword.matrixWorld);
    this.tassel.step(dt, tp, sq, this.gravity, this.breeze);
    this.talisman.step(dt, lp, sq, this.gravity, this.breeze);
    this.knot.position.copy(this.tassel.cap);
    this.knot.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), this.tassel.capDir);
    // the left arm: breathing / walk counter-sway, a pull back while the right slashes, the hook aim
    const bob = s.speed > 0.1 ? Math.sin(s.walk * 2 + 0.8) * 0.006 * s.speed : 0;
    const sway = s.speed > 0.1 ? -Math.sin(s.walk) * 0.006 * s.speed : 0;
    const breathe = Math.sin(s.t * 1.6 + 1.1) * 0.0024;
    const lo = new Vector3(sway - s.lookVel.x * 0.005, bob + breathe + s.lookVel.y * 0.005, 0);
    if (m !== null) {
      const ends = m.keys[m.keys.length - 1]?.t ?? 1;
      const w = Math.sin(clamp(this.moveT / ends, 0, 1) * Math.PI);
      lo.add(new Vector3(...m.left).multiplyScalar(w));
    }
    const ap = this.baseArm.pos.clone().add(lo);
    const aq = this.baseArm.quat.clone();
    const aimW = s.hook > 0 ? Math.min(1, s.hook / 0.12) * (1 - Math.max(0, (s.hook - 0.8) / 0.2)) : 0;
    if (aimW > 0 && s.aimNdc !== null) {
      const target = this.ndc(s.aimNdc.x, s.aimNdc.y, 2.0);
      aq.slerp(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), target.clone().sub(ap).normalize()), aimW * 0.85);
      ap.add(new Vector3(0.05, 0.06, -0.04).multiplyScalar(aimW));
    }
    this.left.position.copy(ap);
    this.left.quaternion.copy(aq);
    this.claw.visible = !(s.hook > 0.02 && s.hook < 0.97);
  }

  /** the trail's state, for the harness */
  get trailLive(): boolean { return this.trailOn; }

  /** the launcher's muzzle on screen (NDC): the filament starts there */
  muzzleNdc(): Vector2 {
    this.left.updateMatrixWorld(true);
    const p = ATTACH.muzzle.clone().applyMatrix4(this.left.matrixWorld);
    p.project(this.camera);
    return new Vector2(p.x, p.y);
  }
}
