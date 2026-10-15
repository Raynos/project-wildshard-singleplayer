import * as THREE from 'three';
import type { ARM_PAL } from '@wildshard/engine/player/nalatiArms';
import { BAKED_HANDS, handsPart } from '../../boot/handsGeometry';
import { loadPainted, painted } from '../looks/paintedTextures';

/**
 * Gloved first-person hands on a held weapon (SHARD-PLATFORM M3, the viewmodel system): the engine's gloved fist
 * (nalatiArms.gloveFist) in a shard's palette, with a forearm, under the weapon's model. The hands are baked
 * (generators/handsPool.ts, one rest-geometry pool the kit preloads); this file borrows them by their HandSpec.
 *
 *   handGeometry(look, spec)                     a gloved fist + a light forearm (gauntlet → knit cuff → canvas sleeve),
 *        in GRIP SPACE (nalatiArms': the grip along +Y through the origin, the back of a right hand toward +X, the forearm
 *        leaving toward +Z); one borrowed geometry, vertex-coloured, for the viewmodels' shared lit program
 *   gripQuat(pose, mirror, out)                  grip space → the weapon's model space, from where the fist closes (`at`),
 *        which way its index / thumb end points along the grip (`axis`) and which way the palm faces (`palm`)
 *   new WeaponHands(look, parent, material, left, right)   the two hands as two meshes (two draws) under a weapon's model:
 *        the left fixed on the weapon, the right posed every frame (`placeRight`) — the grip, the string, the lever, the gate
 *
 * `userData['viewmodelOnly']` keeps them off the world copies of the held weapon. The shard's look row (GloveHandsLook)
 * holds the colours; the shapes are the system's.
 */

/** A palette key of the engine's arm builder (nalatiArms.ARM_PAL). */
export type ArmPaletteKey = keyof typeof ARM_PAL;
/** A palette row over the arm builder's: each key's colour as sRGB hex (linearised when it builds). */
export type ArmPaletteRow = Readonly<Partial<Record<ArmPaletteKey, number>>>;
/** A shard's gloved hands as data: the arm palette, the coat cuff's worn lip and its stitches (sRGB hex). */
export interface GloveHandsLook {
  /** the gloves, the knit cuff and the sleeve's colours over the arm builder's palette */
  readonly palette: ArmPaletteRow;
  /** the coat sleeve's turned-back lip, worn pale */
  readonly coatLip: number;
  /** the coat cuff's stitched seams */
  readonly coatStitch: number;
}

/** The coat's waxed-canvas maps (generators/coatCanvas.ts, baked offline), loaded ahead of `coatMaterialParams`. */
export function loadCoatTextures(): Promise<unknown> {
  return Promise.all([loadPainted('coatMap'), loadPainted('coatNormal'), loadPainted('coatArm')]);
}
/** The coat sleeve's material parameters (the viewmodels' shared program: its five map slots all filled by the canvas). */
export function coatMaterialParams(): THREE.MeshPhysicalMaterialParameters {
  const arm = painted('coatArm');
  return { map: painted('coatMap'), normalMap: painted('coatNormal'), normalScale: new THREE.Vector2(0.8, 0.8), aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 0, envMapIntensity: 0.5, specularIntensity: 0.5 };
}

// ───────────────────────────── a hand ─────────────────────────────

/** A per-channel triple (a tint, a point). */
export type V3 = [number, number, number];
/** One hand as data: the fist's grip, curl and wrist, its forearm and its tints. */
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
  /** × the palette (the viewmodel sits in the weapon's shade: 1 = the palette as it is) */
  tint?: number;
  /** the glove's own tint per channel (linear), over `tint` for the fist and gauntlet */
  gloveTint?: V3;
  /** a free sleeve: the forearm is its own mesh, aimed every frame from the wrist at this point in CAMERA space (an elbow
   *  below the frame), so it keeps coming in from the bottom of the screen whatever the weapon's pose does */
  elbow?: V3;
  /** the coat sleeve (coatSleeve, its own mesh on the coat's textured material) over a short gauntlet, instead of the
   *  plain merged forearm */
  coat?: boolean;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** A hand's geometry: `geometry` = the gloved fist in grip space, with its forearm merged in along the bent wrist — or,
 *  with a separate sleeve (`free`: aimed every frame; `spec.coat`: the coat, on its own material), the fist (+ the coat's
 *  gauntlet) and `sleeve` = the forearm along +Y from its origin, `wrist` = where that origin sits in grip space and `dir`
 *  = the wrist's bend there (grip space). Borrowed from the baked pool: never mutate or dispose it. */
export interface HandGeometry { geometry: THREE.BufferGeometry; sleeve: THREE.BufferGeometry | null; wrist: THREE.Vector3; dir: THREE.Vector3 }
/** A hand's bake key (generators/handsPool.ts): the look, the spec as the weapon passes it, and whether its sleeve is free. */
const handKey = (look: GloveHandsLook, spec: HandSpec, free: boolean): string => JSON.stringify([look, spec, free]);
/** One hand's baked geometry in `look`'s colours (see HandGeometry); a hand the pool was not baked with refuses. */
export function handGeometry(look: GloveHandsLook, spec: HandSpec, free = false): HandGeometry {
  const row = BAKED_HANDS[handKey(look, spec, free)];
  if (row === undefined) throw new Error('[pine-hollow hands] this hand is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return { geometry: handsPart(row.geometry), sleeve: row.sleeve === null ? null : handsPart(row.sleeve), wrist: new THREE.Vector3().fromArray(row.wrist), dir: new THREE.Vector3().fromArray(row.dir) };
}

/** Both hands of a weapon's holds, as `WeaponHands` will ask for them: a missing bake refuses here, before the weapon is
 *  built. The hands are borrowed from the preloaded pool, so there is nothing left to slice (`due` is kept for callers). */
export function prepareWeaponHands(look: GloveHandsLook, left: HandHold, right: HandHold, due?: () => Promise<void> | null): Promise<readonly [HandGeometry, HandGeometry]> {
  void due;
  return Promise.resolve([handGeometry(look, { ...left.spec, mirror: true }, left.spec.elbow !== undefined), handGeometry(look, { ...right.spec, mirror: false }, right.spec.elbow !== undefined)]);
}

/** Where a fist closes on a weapon, in its model space: the grip's centre, the grip's direction toward the index / thumb
 *  end of the finger stack, and the palm's facing (from the back of the hand toward the grip). */
export interface GripPose { at: THREE.Vector3; axis: THREE.Vector3; palm: THREE.Vector3 }
/** A grip pose from three triples (the directions normalised). */
export const gripPose = (at: readonly [number, number, number], axis: readonly [number, number, number], palm: readonly [number, number, number]): GripPose =>
  ({ at: new THREE.Vector3(...at), axis: new THREE.Vector3(...axis).normalize(), palm: new THREE.Vector3(...palm).normalize() });

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
const _w = new THREE.Vector3(), _e = new THREE.Vector3(), _inv = new THREE.Matrix4();
/** Grip space → model space: +Y along `axis`, the back of the hand (+X on a right hand, −X on a left) against `palm`, +Z
 *  (the forearm's side) completing the frame. */
export function gripQuat(p: GripPose, mirror: boolean, out: THREE.Quaternion): THREE.Quaternion {
  _y.copy(p.axis).normalize();
  _x.copy(p.palm).multiplyScalar(mirror ? 1 : -1);
  _x.addScaledVector(_y, -_x.dot(_y)).normalize();
  _z.crossVectors(_x, _y);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

/** `a` → `b` by t (0..1), into `out` (the directions re-normalised). */
export function blendGrip(a: GripPose, b: GripPose, t: number, out: GripPose): GripPose {
  out.at.lerpVectors(a.at, b.at, t);
  out.axis.lerpVectors(a.axis, b.axis, t).normalize();
  out.palm.lerpVectors(a.palm, b.palm, t).normalize();
  return out;
}

// ───────────────────────────── a weapon's two hands ─────────────────────────────

/** A hand's spec and where it grips. */
export interface HandDef { spec: HandSpec; pose: GripPose }
/** A hold as a weapon declares it (a dev knob: edit, then the weapon's `rebuildHands()`). */
export interface HandHold { spec: HandSpec; at: V3; axis: V3; palm: V3 }
/** A declared hold → a hand definition. */
export const holdDef = (h: HandHold): HandDef => ({ spec: h.spec, pose: gripPose(h.at, h.axis, h.palm) });

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
  /** every sleeve mesh (free or riding its fist) */
  private readonly extra: THREE.Mesh[] = [];

  /** `look`: the shard's colours; `coatMaterial`: the coat sleeves' (HandSpec.coat), else they fall back to `material` */
  constructor(look: GloveHandsLook, parent: THREE.Object3D, material: THREE.Material, left: HandDef, right: HandDef, coatMaterial: THREE.Material = material) {
    this.group.name = 'weapon-hands';
    this.group.userData['viewmodelOnly'] = true;
    for (const m of [material, coatMaterial]) { m.transparent = true; m.depthWrite = true; }
    const lg = handGeometry(look, { ...left.spec, mirror: true }, left.spec.elbow !== undefined), rg = handGeometry(look, { ...right.spec, mirror: false }, right.spec.elbow !== undefined);
    this.left = new THREE.Mesh(lg.geometry, material);
    this.right = new THREE.Mesh(rg.geometry, material);
    this.rightSpec = right.spec;
    const meshes = [this.left, this.right];
    this.left.name = 'hand-left'; this.right.name = 'hand-right';
    for (const [fist, g, spec] of [[this.left, lg, left.spec], [this.right, rg, right.spec]] as const) {
      if (g.sleeve === null) continue;
      const mesh = new THREE.Mesh(g.sleeve, spec.coat === true ? coatMaterial : material);
      mesh.name = `${fist.name}-sleeve`;
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      mesh.userData['viewmodelOnly'] = true;
      if (spec.elbow !== undefined) { this.sleeves.push({ fist, mesh, wrist: g.wrist, elbow: new THREE.Vector3(...spec.elbow) }); this.group.add(mesh); }
      else { mesh.position.copy(g.wrist); mesh.quaternion.setFromUnitVectors(Y_AXIS, g.dir); fist.add(mesh); } // rigid: rides its fist
      this.extra.push(mesh);
    }
    for (const m of meshes) {
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1000;
      m.userData['viewmodelOnly'] = true;
      this.group.add(m);
    }
    this.placeLeft(left.pose);
    this.placeRight(right.pose);
    parent.add(this.group);
  }

  /** seat the left fist at `p` */
  placeLeft(p: GripPose): void { this.left.position.copy(p.at); gripQuat(p, true, this.q); this.left.quaternion.copy(this.q); }
  /** seat the right fist at `p` */
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
      s.mesh.position.copy(w);
      s.mesh.quaternion.setFromUnitVectors(Y_AXIS, d);
      s.mesh.visible = s.fist.visible;
    }
  }

  /** the triangles and vertices the two hands add (a draw each) */
  get cost(): { draws: number; tris: number; verts: number; bytes: number } {
    let tris = 0, verts = 0, bytes = 0;
    const meshes = [this.left, this.right, ...this.extra];
    for (const m of meshes) {
      const g = m.geometry, idx = g.getIndex();
      tris += (idx ? idx.count : g.getAttribute('position').count) / 3;
      verts += g.getAttribute('position').count;
      for (const a of Object.values(g.attributes)) if (a instanceof THREE.BufferAttribute) bytes += a.array.byteLength;
      if (idx) bytes += idx.array.byteLength;
    }
    return { draws: meshes.length, tris, verts, bytes };
  }

  /** take the hands off the weapon (their geometry is the pool's, borrowed: it stays) */
  dispose(): void {
    this.group.removeFromParent();
  }
}
