import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { horseBones } from '../species/horse';

/**
 * Reins — the reins, first person (NALATI-FINISH B1, N13 "reins in the hands"; locked in, E331). E320 rework:
 * the rider's hands are where a rider's hands are — low over the withers, just under the frame (the held weapon keeps the
 * hands you see; no second glove to clash with it) — and the two reins come up out of the bottom of the frame, one each
 * side of the neck, along its flanks and under the jowls to the bit. They never cross the back of the head: two straps
 * ending in the middle of the head's dark silhouette made it read as a face looking back at you (E320, the user: "cursed,
 * like they're flipped"). They hang in a little slack, sway with the head and follow its turns; while the bow draws or a
 * bucking round is on they fall slack onto the withers.
 *
 * The anchors come from the horse's own bones (mane2 for the neck, head for the jowl) and the muzzle is found once per horse
 * in its skinned mesh (of the vertices the head bone moves, the one farthest from it) — nothing from the old code-built
 * horse's model space (E328), so the generated horse (Debug ▸ Creatures = Models) and the procedural one both fit.
 *
 *   const reins = new Reins(camera);          // a child of the camera (like the weapon viewmodels)
 *   reins.update(dt, horse, on, drop)          // every frame after the saddle has placed the camera (Game.onLate): `on` =
 *                                              //   mounted; `drop` = the hands are busy (the bow's draw, breaking)
 *
 * Cost: one 64-vertex ribbon rewritten per frame — 1 draw while riding, none on foot. Drawn in the world (depth-tested
 * against the horse), not after the weapon viewmodels' depth clear.
 */

/** where the hands hold the reins: just under the frame's bottom edge (NDC y < −1), a hand's width either side of the
 *  centre, this far in front of the eye — so they enter the frame at the bottom on a phone and a desktop alike */
export const HAND_NDC = { x: 0.2, y: -1.12 }, HAND_DEPTH = 0.55;
/** the withers (body-bone space): where the reins lie when the hands let go */
const WITHERS = new THREE.Vector3(0, 0.42, 0.62);
const SPAN = 5, SEG = SPAN * 3, HALF_W = 0.009;
const LEATHER = new THREE.Color(0.42, 0.26, 0.13), LEATHER_EDGE = new THREE.Color(0.62, 0.42, 0.24);
/** the path's waypoints, each out on the rein's own side: the neck's flank at the mane2 bone (down from the crest, out
 *  past the neck), then under the jowl (below the head bone, out past the cheek), then the bit by the muzzle */
export const NECK_DOWN = -0.05, NECK_OUT = 0.1, JOWL_DOWN = 0.1, JOWL_OUT = 0.17, BIT_BACK = 0.3, BIT_OUT = 0.07;

const _w = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _down = new THREE.Vector3(), _q = new THREE.Quaternion();
const _k0 = new THREE.Vector3(), _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _head = new THREE.Vector3();
const _crest = new THREE.Vector3(), _leftW = new THREE.Vector3(), _upW = new THREE.Vector3(0, 1, 0), _muzzle = new THREE.Vector3(), _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** a uniform Catmull-Rom point (or its tangent) between p1 and p2 at t, into `out` */
function catmull(out: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, tangent: boolean): THREE.Vector3 {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number => tangent
    ? 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2)
    : 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}

/**
 * The two reins' ribbon (E348: the one the rider holds, and the Model Explorer card's own copy,
 * src/shards/nalati-grasslands/models/reins.ts): two strips of SEG + 1 cross-sections, two vertices each, in leather
 * with a lighter edge, their normals toward the eye (camera space). `fillRein` writes a rein's path into `pos`.
 */
export function buildReinsRibbon(): { mesh: THREE.Mesh; pos: Float32Array; attr: THREE.BufferAttribute } {
  // two ribbons of SEG + 1 cross-sections, two vertices each, facing the eye (camera space)
  const verts = 2 * (SEG + 1) * 2;
  const pos = new Float32Array(verts * 3);
  const nrm = new Float32Array(verts * 3), col = new Float32Array(verts * 3), idx: number[] = [];
  for (let v = 0; v < verts; v++) {
    nrm[v * 3 + 2] = 1;
    const c = v % 2 === 0 ? LEATHER_EDGE : LEATHER;
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  for (let r = 0; r < 2; r++) {
    const o = r * (SEG + 1) * 2;
    for (let i = 0; i < SEG; i++) { const a = o + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr);
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return { mesh: new THREE.Mesh(g, painterlyMaterial(null, { rim: 0.3, bands: 0.7, shade: 1.6, side: THREE.DoubleSide })), pos, attr };
}

/**
 * Rein r (0: the horse's left, 1: its right) along K = [the hand's phantom, the hand, the neck's flank, under the jowl,
 * the bit, the bit's phantom] (camera space, the eye at the origin): SPAN cross-sections per span of the Catmull-Rom
 * path, each a flat strap turned to the eye, written into `pos` (buildReinsRibbon's).
 */
export function fillRein(pos: Float32Array, r: number, K: readonly THREE.Vector3[]): void {
  const o = r * (SEG + 1) * 2;
  for (let i = 0; i <= SEG; i++) {
    const span = Math.min(2, Math.floor(i / SPAN)), t = (i - span * SPAN) / SPAN;
    const p0 = K[span], p1 = K[span + 1], p2 = K[span + 2], p3 = K[span + 3];
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) continue;
    catmull(_p, p0, p1, p2, p3, t, false);
    catmull(_t, p0, p1, p2, p3, t, true);
    // a flat strap turned to the eye: its width across the tangent and the line of sight
    _s.crossVectors(_t, _p).normalize().multiplyScalar(HALF_W);
    const k = (o + i * 2) * 3;
    pos[k] = _p.x + _s.x; pos[k + 1] = _p.y + _s.y; pos[k + 2] = _p.z + _s.z;
    pos[k + 3] = _p.x - _s.x; pos[k + 4] = _p.y - _s.y; pos[k + 5] = _p.z - _s.z;
  }
}

export class Reins {
  readonly group = new THREE.Group();
  private readonly pos: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly ribbon: THREE.Mesh;
  /** 1 = in the hands, 0 = dropped on the withers (eased) */
  private held = 1;
  /** the muzzle in the head bone's frame, once per horse */
  private readonly muzzleLocal = new WeakMap<Animal, THREE.Vector3>();

  constructor(private readonly camera: THREE.PerspectiveCamera, scope?: Scope) {
    const { mesh, pos, attr } = buildReinsRibbon();
    this.pos = pos; this.posAttr = attr; this.ribbon = mesh;
    this.ribbon.frustumCulled = false; this.ribbon.castShadow = false; this.ribbon.receiveShadow = false;
    this.ribbon.raycast = () => undefined;   // never in an aim ray / pick
    this.group.add(this.ribbon);
    this.group.name = 'reins';
    this.group.visible = false;
    camera.add(this.group);
    scope?.own(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) scope?.own(material);
    scope?.onDispose(() => { this.group.removeFromParent(); });
  }

  /** the muzzle in the head bone's frame: of the vertices the head bone moves most, the one farthest from it (bind pose:
   *  bone⁻¹ · bindMatrix · v) — found in the horse's own mesh, whichever horse it is */
  private muzzleOf(a: Animal): THREE.Vector3 | null {
    const hit = this.muzzleLocal.get(a);
    if (hit !== undefined) return hit;
    const mesh = a.mesh, sk = mesh.skeleton, head = sk.getBoneByName('head');
    if (head === undefined) return null;   // not a horse rig
    const hi = sk.bones.indexOf(head), inv = sk.boneInverses[hi];
    if (inv === undefined) return null;
    const g = mesh.geometry, pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
    _m.multiplyMatrices(inv, mesh.bindMatrix);
    let best: THREE.Vector3 | null = null, bd = -1;
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === hi) w += sw.getComponent(i, c);
      if (w < 0.6) continue;
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      const d = _v.lengthSq();
      if (d > bd) { bd = d; best = (best ?? new THREE.Vector3()).copy(_v); }
    }
    if (best === null) return null;
    this.muzzleLocal.set(a, best);
    return best;
  }

  update(dt: number, horse: Animal | null, on: boolean, drop: boolean): void {
    if (!on || horse === null) { this.group.visible = false; this.held = 1; return; }
    const muzzle = this.muzzleOf(horse);
    if (muzzle === null) { this.group.visible = false; return; }
    this.group.visible = true;
    const cam = this.camera;
    cam.updateMatrixWorld();
    horse.mesh.updateMatrixWorld(true);
    this.held += ((drop ? 0 : 1) - this.held) * Math.min(1, dt * 7);
    // the world → the eye's frame: the withers, the neck, the head, the muzzle, "down" and the horse's left
    const bones = horseBones(horse), toCam = cam.matrixWorldInverse, head = bones.head;
    _crest.setFromMatrixPosition(bones.mane2.matrixWorld);
    _head.setFromMatrixPosition(head.matrixWorld);
    _muzzle.copy(muzzle).applyMatrix4(head.matrixWorld);
    _w.copy(WITHERS).applyMatrix4(bones.body.matrixWorld).applyMatrix4(toCam);
    cam.getWorldQuaternion(_q).invert();
    _down.set(0, -1, 0).applyQuaternion(_q);
    _leftW.set(Math.cos(horse.yaw), 0, -Math.sin(horse.yaw));
    const tanF = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    for (let r = 0; r < 2; r++) {
      const side = r === 0 ? 1 : -1;   // r 0 = the horse's left rein (on the screen's left: the view looks along the horse)
      // the bit: back from the muzzle toward the head bone, out to this side of the mouth
      _b.copy(_muzzle).lerp(_head, BIT_BACK).addScaledVector(_leftW, side * BIT_OUT).applyMatrix4(toCam);
      // the hand: under the frame on this side, or the withers when the hands let go
      _e.set(-side * HAND_NDC.x * HAND_DEPTH * tanF * cam.aspect, HAND_NDC.y * HAND_DEPTH * tanF, -HAND_DEPTH).lerp(_w, 1 - this.held);
      // the neck's flank, then under the jowl — out on this side; dropped, the neck point sinks onto the neck
      _k1.copy(_crest).addScaledVector(_upW, -NECK_DOWN).addScaledVector(_leftW, side * NECK_OUT).applyMatrix4(toCam).addScaledVector(_down, (1 - this.held) * 0.05);
      _k2.copy(_head).addScaledVector(_upW, -JOWL_DOWN).addScaledVector(_leftW, side * JOWL_OUT).applyMatrix4(toCam);
      _k0.copy(_e).multiplyScalar(2).sub(_k1);           // phantom ends: the path leaves the hand and meets the bit straight
      _k3.copy(_b).multiplyScalar(2).sub(_k2);
      fillRein(this.pos, r, [_k0, _e, _k1, _k2, _b, _k3]);
    }
    this.posAttr.needsUpdate = true;
  }
}
