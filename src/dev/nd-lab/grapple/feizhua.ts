// Lab P9 "grapple" (E169): the Fei Zhua rig. Loads blender/fei_zhua.py's model (public/assets/nine-dragon/lab/grapple/
// fei-zhua.glb, meshopt) and builds:
//  - the viewmodel arm (its own scene, drawn after the world in the near depth slice): the static parts merged into ONE
//    body + ONE ink hull, the spinning spool, and the docked claw (hub + three talons on their hinges);
//  - a second claw for the world (the one that flies, bites the dragon hook and is reeled back), sharing the geometry.
// Every part uses the one hero program (vm-material.ts) + its ink hull: 12 draws for the arm, 8 for a flying claw.
// Frames: glTF's (the Blender script's +Y forward becomes −Z, +Z up becomes +Y, +X stays the inner side).
import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addHullNormals, inkHullMaterial, toFloat, vmMaterial, type VmUniforms } from './vm-material';

// the pivots, as fei_zhua.py writes them (Blender (x, y, z) → glTF (x, z, −y))
export const SPOOL_PIVOT = new Vector3(0.0395, 0.040, 0.112);
export const CLAW_PIVOT = new Vector3(0.0, 0.060, -0.112);
/** talon 0's hinge relative to the claw's centre (claw-local, glTF frame) */
export const HINGE = new Vector3(0.0, 0.0168, -0.010);
/** the muzzle's mouth (arm-local): where the line leaves */
export const MUZZLE = new Vector3(0.0, 0.060, -0.1065);
/** the claw's rear eyelet (claw-local): where the line ties on */
export const EYELET = new Vector3(0.0, 0.0, 0.0325);
/** the capacitor's centre (arm-local): its glow lights the housing */
export const CAPACITOR = new Vector3(0.0, 0.078, 0.12);
export const TALON_FOLD = (2 * Math.PI) / 180;
export const TALON_OPEN = (64 * Math.PI) / 180;
export const TALON_GRIP = (20 * Math.PI) / 180;
/** the lock-on: the talons spring half open, armed (comp-B's crown) */
export const TALON_ARMED = (34 * Math.PI) / 180;

interface Part { geo: BufferGeometry }

const _q = new Quaternion(), _r = new Quaternion(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3(), _m = new Matrix4();
const Z_AXIS = new Vector3(0, 0, 1), UP = new Vector3(0, 1, 0);
/** the arm's matrix in view space: wrist at `wrist`, forearm along `fwd` (the muzzle's way), rolled `roll` about it */
export function armMatrix(wrist: Vector3, fwd: Vector3, roll: number, out: Matrix4): Matrix4 {
  _z.copy(fwd).normalize().negate();
  _x.copy(UP).cross(_z).normalize();
  _y.copy(_z).cross(_x).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  _q.multiply(_r.setFromAxisAngle(Z_AXIS, roll));
  return out.compose(wrist, _q, _x.set(1, 1, 1));
}

async function loadParts(url: string): Promise<Map<string, Part>> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const out = new Map<string, Part>();
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = toFloat((o.geometry as BufferGeometry).clone());
    // bake the node's transform (its pivot + meshopt's dequantisation) into the positions: absolute arm frame
    g.applyMatrix4(o.matrixWorld);
    const col = g.getAttribute('color');
    g.setAttribute('aData', col);
    g.deleteAttribute('color');
    g.computeBoundingSphere();
    out.set(o.name, { geo: g });
  });
  return out;
}

function need(m: Map<string, Part>, k: string): BufferGeometry {
  const p = m.get(k);
  if (p === undefined) throw new Error(`fei-zhua.glb: no part ${k}`);
  return p.geo;
}

/** one body + one ink hull on the same geometry */
function inked(geo: BufferGeometry, u: VmUniforms, mats: { body: ReturnType<typeof vmMaterial>; hull: ReturnType<typeof inkHullMaterial> }): Group {
  const g = new Group();
  const body = new Mesh(geo, mats.body);
  const hull = new Mesh(geo, mats.hull);
  body.frustumCulled = false;
  hull.frustumCulled = false;
  void u;
  g.add(body, hull);
  return g;
}

/** a claw: the hub at the origin (glTF frame, axis −Z = the flight direction), three talons on their hinges */
export class Claw {
  readonly root = new Group();
  readonly talons: Group[] = [];

  constructor(hub: BufferGeometry, talon: BufferGeometry, u: VmUniforms, mats: { body: ReturnType<typeof vmMaterial>; hull: ReturnType<typeof inkHullMaterial> }) {
    this.root.add(inked(hub, u, mats));
    for (let i = 0; i < 3; i++) {
      const ang = [90, 210, 330][i] ?? 90;
      const spin = new Group();
      // Blender's −(a − 90°) about +Y is +(a − 90°) about glTF +Z (the claw's axis)
      spin.rotation.z = ((ang - 90) * Math.PI) / 180;
      const hinge = new Group();
      hinge.position.copy(HINGE);
      hinge.add(inked(talon, u, mats));
      spin.add(hinge);
      this.root.add(spin);
      this.talons.push(hinge);
    }
  }

  /** hinge angle (rad): + opens outward (Blender +X rotation = glTF +X rotation) */
  setTalons(a: number): void {
    for (const t of this.talons) t.rotation.x = a;
  }
}

export class FeiZhua {
  readonly scene = new Scene();
  /** the arm, in view space (the viewmodel camera sits at the origin looking down −Z) */
  readonly arm = new Group();
  readonly spool = new Group();
  readonly clawVm: Claw;
  readonly clawWorld: Claw;
  readonly u: VmUniforms;
  readonly tris: { arm: number; claw: number };
  private readonly mats: { body: ReturnType<typeof vmMaterial>; hull: ReturnType<typeof inkHullMaterial> };

  private constructor(parts: Map<string, Part>, u: VmUniforms) {
    this.u = u;
    const mats = { body: vmMaterial(u), hull: inkHullMaterial(u) };
    this.mats = mats;
    // static parts → one geometry
    const statics = ['sleeve', 'bracer', 'housing', 'fist'].map((k) => need(parts, k));
    const merged = mergeGeometries(statics.map((g) => { const c = g.clone(); c.deleteAttribute('aHullN'); return c; }), false);
    addHullNormals(merged);
    this.arm.add(inked(merged, u, mats));
    // the spool: vertices relative to its axle
    const sp = need(parts, 'spool').clone();
    sp.translate(-SPOOL_PIVOT.x, -SPOOL_PIVOT.y, -SPOOL_PIVOT.z);
    addHullNormals(sp);
    this.spool.position.copy(SPOOL_PIVOT);
    this.spool.add(inked(sp, u, mats));
    this.arm.add(this.spool);
    // the claw: hub relative to its centre, the talon relative to talon 0's hinge
    const hub = need(parts, 'claw').clone();
    hub.translate(-CLAW_PIVOT.x, -CLAW_PIVOT.y, -CLAW_PIVOT.z);
    addHullNormals(hub);
    const tal = need(parts, 'talon').clone();
    const h0 = CLAW_PIVOT.clone().add(HINGE);
    tal.translate(-h0.x, -h0.y, -h0.z);
    addHullNormals(tal);
    this.clawVm = new Claw(hub, tal, u, mats);
    this.clawVm.root.position.copy(CLAW_PIVOT);
    this.arm.add(this.clawVm.root);
    this.clawWorld = new Claw(hub, tal, u, mats);
    this.clawWorld.root.visible = false;
    this.scene.add(this.arm);
    const count = (g: BufferGeometry): number => (g.index === null ? g.getAttribute('position').count : g.index.count) / 3;
    this.tris = { arm: count(merged) + count(sp) + count(hub) + 3 * count(tal), claw: count(hub) + 3 * count(tal) };
  }

  /**
   * The launcher's dragon-head ornament (comp-B paints one on top of the gauntlet): the dragon hook's TRELLIS casting
   * with its plate and ring clipped off, 6 cm long, on the barrel's saddle facing the muzzle. Baked data: an AO from
   * the facing (up = open), brass.
   */
  setOrnament(raw: BufferGeometry): void {
    const src = raw.index === null ? raw : raw.toNonIndexed();
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const P: number[] = [], N: number[] = [], D: number[] = [];
    const s = 0.078;
    const m = new Matrix4().makeTranslation(0, 0.0805 - 0.38 * s, 0.028).multiply(new Matrix4().makeRotationY(Math.PI)).multiply(new Matrix4().makeScale(s, s, s));
    const nm = new Matrix4().makeRotationY(Math.PI);
    const v = new Vector3(), w = new Vector3();
    for (let i = 0; i + 2 < p.count; i += 3) {
      const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (cz < -0.06 || (cy < 0.52 && cz > 0.42)) continue;
      for (let k = 0; k < 3; k++) {
        v.set(p.getX(i + k), p.getY(i + k), p.getZ(i + k)).applyMatrix4(m);
        w.set(n.getX(i + k), n.getY(i + k), n.getZ(i + k)).applyMatrix4(nm).normalize();
        P.push(v.x, v.y, v.z);
        N.push(w.x, w.y, w.z);
        D.push(0.55 + 0.45 * Math.min(1, Math.max(0, w.y * 0.5 + 0.5)), 0.5, 0, 0);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new Float32BufferAttribute(N, 3));
    g.setAttribute('aData', new Float32BufferAttribute(D, 4));
    g.computeBoundingSphere();
    addHullNormals(g, 1e-5);
    const orn = inked(g, this.u, this.mats);
    orn.name = 'ornament';
    this.arm.add(orn);
    this.tris.arm += P.length / 9;
  }

  static async load(url: string, u: VmUniforms): Promise<FeiZhua> {
    return new FeiZhua(await loadParts(url), u);
  }

  /**
   * Pose the arm in view space: the wrist at `wrist`, the forearm pointing along `fwd` (the muzzle's way), rolled by
   * `roll` about it (0 = the launcher's top toward view-space up).
   */
  pose(wrist: Vector3, fwd: Vector3, roll: number): void {
    armMatrix(wrist, fwd, roll, this.arm.matrix);
    this.arm.matrix.decompose(this.arm.position, this.arm.quaternion, this.arm.scale);
    this.arm.updateMatrixWorld(true);
  }

  /** an arm-local point → view space (after pose) */
  armToView(p: Vector3, out = new Vector3()): Vector3 {
    return out.copy(p).applyMatrix4(this.arm.matrixWorld);
  }
}
