import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARM_PAL, gloveFist } from './nalatiArms';

/**
 * hunterHands — the Pine Hollow hunter's first-person hands: the Longbow's dark-tan leather gloves (nalatiArms.gloveFist in
 * the hunter's palette), here on the crossbow and the lever-action too (E322 F-M6, Jake's pick B: always on).
 *
 *   withHunterPalette(() => gloveFist(…))      build nalatiArms geometry in the hunter's colours (the Longbow's hands)
 *   handGeometry(spec)                          a gloved fist + a light forearm (gauntlet → knit cuff → waxed-canvas sleeve),
 *        in GRIP SPACE (nalatiArms': the grip along +Y through the origin, the back of a right hand toward +X, the forearm
 *        leaving toward +Z); one geometry, vertex-coloured, for the viewmodels' shared lit program
 *   gripQuat(pose, mirror, out)                 grip space → the weapon's model space, from where the fist closes (`at`),
 *        which way its index / thumb end points along the grip (`axis`) and which way the palm faces (`palm`)
 *   new WeaponHands(parent, material, left, right)   the two hands as two meshes (two draws) under a weapon's model: the left
 *        fixed on the weapon, the right posed every frame (`placeRight`) — the grip, the string, the lever, the gate
 *
 * Always on in Pine Hollow (Jake picked B over no hands). `userData['viewmodelOnly']` keeps them off the
 * world copies of the held weapon (Skins.crossbowDisplayModel) — the Model Explorer's Gear cards are built from
 * `buildCrossbow` / `leverSpecimen`, never from the held viewmodel, so they carry no hands either way.
 */

const lin = (hex: number): THREE.Color => new THREE.Color(hex).convertSRGBToLinear();
/** a hunter's dark-tan leather gloves, a grey knit cuff, the sleeve of a waxed-canvas coat with leather patches */
export const HUNTER_PAL: Partial<Record<keyof typeof ARM_PAL, THREE.Color>> = {
  leather: lin(0x6a4a30), leatherLight: lin(0x8a6646), leatherDark: lin(0x3a281a), leatherEdge: lin(0x4a3424), thread: lin(0xa89878),
  fleece: lin(0x6e685e), fleeceShade: lin(0x524c44), fleeceDeep: lin(0x3a352f),
  wool: lin(0x5e5038), woolShade: lin(0x3e3424), red: lin(0x4a3422), redDeep: lin(0x33251a), redLine: lin(0x2a1e14),
};
/** build with the hunter's palette, then put Nalati's back (the module's palette is shared) */
export function withHunterPalette<T>(build: () => T): T {
  const saved = new Map<keyof typeof ARM_PAL, THREE.Color>();
  for (const k of Object.keys(HUNTER_PAL) as (keyof typeof ARM_PAL)[]) { const c = HUNTER_PAL[k]; if (c === undefined) continue; saved.set(k, ARM_PAL[k].clone()); ARM_PAL[k].copy(c); }
  try { return build(); } finally { for (const [k, c] of saved) ARM_PAL[k].copy(c); }
}

// ───────────────────────────── the forearm ─────────────────────────────

/** smooth value noise (build-time only) */
function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const GAUNT = 0.068, CUFF = 0.118;
/**
 * The forearm from the wrist along +Y, `len` m: the glove's flared gauntlet with a rolled, stitched edge, a ribbed grey
 * knit cuff, then the waxed-canvas coat sleeve (soft folds, a darker seam). 32 around, ~40 rings: ~2.5 k triangles (the
 * Longbow's `riderArm` is ~36 k — its sleeve ornament is Nalati's; here only a hand's length of it is ever in view).
 */
export function hunterSleeve(len = 0.55, seed = 1): THREE.BufferGeometry {
  const P = HUNTER_PAL, leather = P.leather ?? ARM_PAL.leather, leatherLight = P.leatherLight ?? ARM_PAL.leatherLight;
  const leatherDark = P.leatherDark ?? ARM_PAL.leatherDark, edge = P.leatherEdge ?? ARM_PAL.leatherEdge, thread = P.thread ?? ARM_PAL.thread;
  const knit = P.fleece ?? ARM_PAL.fleece, knitShade = P.fleeceShade ?? ARM_PAL.fleeceShade, knitDeep = P.fleeceDeep ?? ARM_PAL.fleeceDeep;
  const canvas = P.wool ?? ARM_PAL.wool, canvasShade = P.woolShade ?? ARM_PAL.woolShade;
  const RAD = 32;
  const ys: number[] = [];
  for (let y = 0; y < len;) { ys.push(y); y += y < GAUNT ? 0.0085 : y < CUFF + 0.01 ? 0.005 : y < 0.25 ? 0.02 : 0.045; }
  ys.push(len);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  for (const y of ys) {
    for (let k = 0; k <= RAD; k++) {
      const a = k / RAD, ph = a * Math.PI * 2;
      let r: number;
      if (y < GAUNT) { // the gauntlet: flares, a rolled edge; a stitched seam down its outer side
        const t = y / GAUNT;
        r = 0.033 + 0.011 * t * t + 0.0022 * Math.exp(-(((t - 0.93) / 0.06) ** 2));
        c.copy(leather).lerp(leatherLight, 0.22 + 0.18 * Math.sin(ph + 0.4));
        if (t > 0.86) c.lerp(edge, 0.6);
        if (Math.abs(Math.sin(ph * 0.5 - 0.3)) < 0.05 && t > 0.15 && t < 0.85) c.lerp(thread, 0.45);
        c.multiplyScalar(0.9 + 0.1 * vnoise(ph * 4, y * 90 + seed));
        if (t < 0.12) c.lerp(leatherDark, 0.5 * (1 - t / 0.12));
      } else if (y < CUFF) { // the knit cuff: ribs round it, bunched
        const t = (y - GAUNT) / (CUFF - GAUNT), rib = Math.cos(ph * 12);
        r = 0.044 + 0.006 * Math.sin(t * Math.PI) ** 0.7 + 0.0011 * rib;
        c.copy(knit).lerp(knitShade, 0.35 * (0.5 - 0.5 * rib) + 0.2 * vnoise(ph * 9 + seed, y * 300)).lerp(knitDeep, 0.45 * (1 - Math.sin(t * Math.PI)) ** 2);
      } else { // the waxed-canvas sleeve
        const s = y - CUFF;
        const fold = Math.sin(ph * 3 + y * 7 + seed) * 0.6 + Math.sin(ph * 5 - y * 11 + seed * 2) * 0.4;
        r = 0.049 + Math.min(1, s / 0.3) * 0.012 + 0.0028 * fold * Math.min(1, s / 0.04);
        c.copy(canvas).lerp(canvasShade, 0.4 * Math.max(0, -fold) + 0.45 * Math.exp(-s * 45));
        if (Math.abs(Math.sin(ph * 0.5 + 1.1)) < 0.035) c.lerp(canvasShade, 0.7); // the sleeve's seam
        c.multiplyScalar(0.92 + 0.1 * vnoise(ph * 14, y * 60 + seed));
      }
      pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = RAD + 1;
  for (let i = 0; i < ys.length - 1; i++) for (let k = 0; k < RAD; k++) {
    const a = i * row + k, b = a + 1, d = a + row, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────────────────────────── a hand ─────────────────────────────

export interface HandSpec {
  /** radius of what the fist closes on (nalatiArms.gloveFist) */
  R: number;
  /** the left hand */
  mirror?: boolean;
  /** the finger stack's length (1 = 8.5 cm) */
  span?: number;
  /** how far the fingers close (1 = a fist, less = a cradle) */
  curl?: number;
  /** the thumb's (default: `curl`) */
  thumbCurl?: number;
  /** the wrist's bend: the forearm heads along +Z + bend[0]·(the back of the hand) + bend[1]·(+Y, toward the index) */
  bend?: readonly [number, number];
  /** the forearm's length from the wrist (m) */
  armLen?: number;
  /** × the palette (the viewmodel sits in the weapon's shade: 1 = the Longbow's gloves as they are) */
  tint?: number;
  /** a free sleeve: the forearm is its own mesh, aimed every frame from the wrist at this point in CAMERA space (an elbow
   *  below the frame), so it keeps coming in from the bottom of the screen whatever the weapon's pose does */
  elbow?: V3;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** the vertex-colour attributes the viewmodel program reads, the palette × `tint`, a zero uv (its map slots hold 1×1 fillers) */
function finish(g: THREE.BufferGeometry, tint: number): THREE.BufferGeometry {
  if (tint !== 1) { const c = g.getAttribute('color'); for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * tint, c.getY(i) * tint, c.getZ(i) * tint); }
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  g.computeBoundingSphere();
  return g;
}
const onlyPNC = (g: THREE.BufferGeometry): THREE.BufferGeometry => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); return g; };

/** A hand's geometry: `geometry` = the gloved fist in grip space, with its forearm merged in along the bent wrist — or, for
 *  a free sleeve (`free`), the fist alone and `sleeve` = the forearm along +Y from its start (placed every frame), `wrist`
 *  = where that starts in grip space. */
export interface HandGeometry { geometry: THREE.BufferGeometry; sleeve: THREE.BufferGeometry | null; wrist: THREE.Vector3 }
export function handGeometry(spec: HandSpec, free = false): HandGeometry {
  const mirror = spec.mirror === true, sx = mirror ? -1 : 1, tint = spec.tint ?? 1;
  return withHunterPalette(() => {
    const fist = gloveFist({ R: spec.R, mirror, span: spec.span ?? 1, curl: spec.curl ?? 1, thumbCurl: spec.thumbCurl ?? spec.curl ?? 1 });
    const bend = spec.bend ?? [0.12, 0];
    const d = new THREE.Vector3(sx * bend[0], bend[1], 1).normalize();
    const arm = onlyPNC(hunterSleeve(spec.armLen ?? 0.55, mirror ? 2 : 1));
    const start = fist.wrist.clone().addScaledVector(d, -0.016); // the gauntlet laps over the back of the hand
    if (free) return { geometry: finish(onlyPNC(fist.geometry), tint), sleeve: finish(arm, tint), wrist: fist.wrist.clone() };
    arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d));
    arm.translate(start.x, start.y, start.z);
    const out = mergeGeometries([onlyPNC(fist.geometry), arm], false);
    fist.geometry.dispose(); arm.dispose();
    return { geometry: finish(out, tint), sleeve: null, wrist: start };
  });
}

/** Where a fist closes on a weapon, in its model space: the grip's centre, the grip's direction toward the index / thumb
 *  end of the finger stack, and the palm's facing (from the back of the hand toward the grip). */
export interface GripPose { at: THREE.Vector3; axis: THREE.Vector3; palm: THREE.Vector3 }
export const gripPose = (at: readonly [number, number, number], axis: readonly [number, number, number], palm: readonly [number, number, number]): GripPose =>
  ({ at: new THREE.Vector3(...at), axis: new THREE.Vector3(...axis).normalize(), palm: new THREE.Vector3(...palm).normalize() });

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
const _w = new THREE.Vector3(), _e = new THREE.Vector3(), _inv = new THREE.Matrix4();
/** grip space → model space: +Y along `axis`, the back of the hand (+X on a right hand, −X on a left) against `palm`, +Z (the
 *  forearm's side) completing the frame */
export function gripQuat(p: GripPose, mirror: boolean, out: THREE.Quaternion): THREE.Quaternion {
  _y.copy(p.axis).normalize();
  _x.copy(p.palm).multiplyScalar(mirror ? 1 : -1);
  _x.addScaledVector(_y, -_x.dot(_y)).normalize();
  _z.crossVectors(_x, _y);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

/** `a` → `b` by t (0..1), into `out` (the directions re-normalised) */
export function blendGrip(a: GripPose, b: GripPose, t: number, out: GripPose): GripPose {
  out.at.lerpVectors(a.at, b.at, t);
  out.axis.lerpVectors(a.axis, b.axis, t).normalize();
  out.palm.lerpVectors(a.palm, b.palm, t).normalize();
  return out;
}

// ───────────────────────────── a weapon's two hands ─────────────────────────────

export interface HandDef { spec: HandSpec; pose: GripPose }
export type V3 = [number, number, number];
/** a hold as a weapon declares it (a dev knob: edit, then the weapon's `rebuildHands()`) */
export interface HandHold { spec: HandSpec; at: V3; axis: V3; palm: V3 }
export const holdDef = (h: HandHold): HandDef => ({ spec: h.spec, pose: gripPose(h.at, h.axis, h.palm) });
/** the hands' material parameters (the Longbow's: the viewmodels' shared lit program, vertex colours × the 1×1 fillers) */
export const HANDS_MATERIAL: THREE.MeshPhysicalMaterialParameters = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };

/**
 * A weapon's two gloved hands under its model (they move, scale and hide with it): the left fixed where `left.pose` puts
 * it, the right re-posed by `placeRight` (the weapon's own animation drives it). Two meshes on one material — two draws,
 * the viewmodel's queue (transparent, render order 1000, after the depth clear), no shadow cast.
 */
export class WeaponHands {
  readonly group = new THREE.Group();
  readonly left: THREE.Mesh; readonly right: THREE.Mesh;
  readonly rightSpec: HandSpec;
  /** the free sleeves (HandSpec.elbow): mesh, its start in the fist's grip space, the elbow in camera space */
  private readonly sleeves: { fist: THREE.Mesh; mesh: THREE.Mesh; wrist: THREE.Vector3; elbow: THREE.Vector3 }[] = [];
  private readonly q = new THREE.Quaternion();

  constructor(parent: THREE.Object3D, material: THREE.Material, left: HandDef, right: HandDef) {
    this.group.name = 'weapon-hands';
    this.group.userData['viewmodelOnly'] = true;
    material.transparent = true; material.depthWrite = true;
    const lg = handGeometry({ ...left.spec, mirror: true }, left.spec.elbow !== undefined), rg = handGeometry({ ...right.spec, mirror: false }, right.spec.elbow !== undefined);
    this.left = new THREE.Mesh(lg.geometry, material);
    this.right = new THREE.Mesh(rg.geometry, material);
    this.rightSpec = right.spec;
    const meshes = [this.left, this.right];
    for (const [fist, g, spec] of [[this.left, lg, left.spec], [this.right, rg, right.spec]] as const) {
      if (g.sleeve === null || spec.elbow === undefined) continue;
      const mesh = new THREE.Mesh(g.sleeve, material);
      mesh.name = `${fist === this.left ? 'left' : 'right'}-sleeve`;
      this.sleeves.push({ fist, mesh, wrist: g.wrist, elbow: new THREE.Vector3(...spec.elbow) });
      meshes.push(mesh);
    }
    for (const m of meshes) {
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1000;
      m.userData['viewmodelOnly'] = true;
      this.group.add(m);
    }
    this.left.name = 'hand-left'; this.right.name = 'hand-right';
    this.placeLeft(left.pose);
    this.placeRight(right.pose);
    parent.add(this.group);
  }

  placeLeft(p: GripPose): void { this.left.position.copy(p.at); gripQuat(p, true, this.q); this.left.quaternion.copy(this.q); }
  placeRight(p: GripPose): void { this.right.position.copy(p.at); gripQuat(p, false, this.q); this.right.quaternion.copy(this.q); }

  /** aim the free sleeves: each from its fist's wrist at its elbow (camera space). `model` = the weapon's model, a child of
   *  the camera, its pose for this frame set (its local matrix is refreshed here). */
  aim(model: THREE.Object3D): void {
    if (this.sleeves.length === 0 || !this.group.visible) return;
    model.updateMatrix();
    _inv.copy(model.matrix).invert();
    for (const s of this.sleeves) {
      const w = _w.copy(s.wrist).applyQuaternion(s.fist.quaternion).add(s.fist.position);
      const d = _e.copy(s.elbow).applyMatrix4(_inv).sub(w).normalize();
      s.mesh.position.copy(w).addScaledVector(d, -0.016);
      s.mesh.quaternion.setFromUnitVectors(Y_AXIS, d);
      s.mesh.visible = s.fist.visible;
    }
  }

  /** the triangles and vertices the two hands add (a draw each) */
  get cost(): { draws: number; tris: number; verts: number; bytes: number } {
    let tris = 0, verts = 0, bytes = 0;
    const meshes = [this.left, this.right, ...this.sleeves.map((s) => s.mesh)];
    for (const m of meshes) {
      const g = m.geometry, idx = g.getIndex();
      tris += (idx ? idx.count : g.getAttribute('position').count) / 3;
      verts += g.getAttribute('position').count;
      for (const a of Object.values(g.attributes)) if (a instanceof THREE.BufferAttribute) bytes += a.array.byteLength;
      if (idx) bytes += idx.array.byteLength;
    }
    return { draws: meshes.length, tris, verts, bytes };
  }

  dispose(): void {
    this.group.removeFromParent();
    this.left.geometry.dispose(); this.right.geometry.dispose();
    for (const s of this.sleeves) s.mesh.geometry.dispose();
  }
}
