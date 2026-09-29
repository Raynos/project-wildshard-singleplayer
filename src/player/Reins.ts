import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import { horseBones } from '../entities/species/horse';
import { gloveFist, riderArm, placeArm } from './nalatiArms';
import { painterlyMaterial } from '../world/painterly';

/**
 * Reins — the reins in the rider's hand, first person (NALATI-FINISH B1, N13 "reins in the hands"; Debug ▸ Riding: reins in
 * hand). A gloved left fist (the Nalati rider's glove and sleeve, nalatiArms.ts) rides low on the left of the frame, left of
 * the horse's neck and above the thumb stick, and the two reins run from it forward to the bit on either side of the
 * horse's mouth — the right one over the crest. They hang in a little slack, sway with the horse's head, and follow its
 * turns. While you draw the bow (both hands on it) or hang on through a bucking round, the fist drops out of the frame and
 * the reins fall slack onto the withers.
 *
 *   const reins = new Reins(camera);          // a child of the camera (like the weapon viewmodels)
 *   reins.update(dt, horse, on, drop)          // every frame after the saddle has placed the camera: `on` = mounted and
 *                                              //   the Debug row on; `drop` = the hands are busy (the bow's draw, breaking)
 *
 * Cost: the fist + sleeve are one static mesh each (~15 k verts, built once), the reins one 60-vertex ribbon rewritten per
 * frame — 3 draws while riding, none on foot. Drawn in the world (depth-tested against the horse), not after the weapon
 * viewmodels' depth clear.
 */

/** the bit rings either side of the mouth (horse.ts tack, the model's space at scale 1) */
const BIT: readonly THREE.Vector3[] = [new THREE.Vector3(0.075, 1.39, 1.47), new THREE.Vector3(-0.075, 1.39, 1.47)];
/** where the fist rides: a point on screen (NDC) at this many metres in front of the eye — so it sits the same on a phone
 *  in portrait and a desktop in landscape */
const HAND_NDC = { x: -0.3, y: -0.57 }, HAND_DEPTH = 0.5, HAND_SCALE = 0.8;
/** the fist's turn in the camera's frame: the grip upright, its top tilted back to the rider, the back of the hand out-left */
const HAND_ROT = new THREE.Euler(0.55, 0.45, 0.1, 'YXZ');
/** the withers (body-bone space): where the reins lie when the hands let go */
const WITHERS = new THREE.Vector3(0, 0.42, 0.62);
const SPAN = 5, SEG = SPAN * 3, HALF_W = 0.006;
const LEATHER = new THREE.Color(0.25, 0.14, 0.075), LEATHER_EDGE = new THREE.Color(0.42, 0.26, 0.14);
/** the reins lie on the neck, not through it: over the crest (the mane2 bone) and past the poll (the head bone), each a
 *  little up and out to the rein's own side */
const CREST_UP = 0.11, CREST_OUT = 0.06, POLL_UP = 0.0, POLL_OUT = 0.14;

const _w = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _down = new THREE.Vector3(), _q = new THREE.Quaternion();
const _k0 = new THREE.Vector3(), _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _poll = new THREE.Vector3();
const _hand = new THREE.Vector3(), _bottom = new THREE.Vector3(), _crest = new THREE.Vector3(), _leftW = new THREE.Vector3(), _upW = new THREE.Vector3(0, 1, 0);

/** a uniform Catmull-Rom point (or its tangent) between p1 and p2 at t, into `out` */
function catmull(out: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, tangent: boolean): THREE.Vector3 {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number => tangent
    ? 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2)
    : 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}

export class Reins {
  readonly group = new THREE.Group();
  private readonly fist = new THREE.Group();
  private readonly pos: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly ribbon: THREE.Mesh;
  /** 1 = in the fist, 0 = dropped on the withers (eased) */
  private held = 1;
  /** the grip's bottom in the fist's frame: where the reins leave the hand for the bit */
  private readonly gripBottom = new THREE.Vector3(0, -0.05, 0.004);
  private readonly bitLocal = new WeakMap<Animal, THREE.Vector3[]>();

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    const mat = painterlyMaterial(null, { rim: 0.5, bands: 0.7, shade: 1.8 });
    const f = gloveFist({ R: 0.011, mirror: true, span: 0.95 });
    const hand = new THREE.Mesh(f.geometry, mat);
    const arm = new THREE.Mesh(riderArm(0.26, 3), mat);
    placeArm(arm, f.wrist, f.wristDir);
    this.fist.add(hand, arm);
    this.fist.rotation.copy(HAND_ROT);
    this.fist.scale.setScalar(HAND_SCALE);
    // the reins: two ribbons of SEG + 1 cross-sections, two vertices each, facing the eye (camera space)
    const verts = 2 * (SEG + 1) * 2;
    this.pos = new Float32Array(verts * 3);
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
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.ribbon = new THREE.Mesh(g, painterlyMaterial(null, { rim: 0.3, bands: 0.7, shade: 1.6, side: THREE.DoubleSide }));
    this.group.add(this.fist, this.ribbon);
    this.group.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.raycast = () => undefined;   // never in an aim ray / pick
    });
    this.group.name = 'reins';
    this.group.visible = false;
    camera.add(this.group);
  }

  /** the bit rings in the head bone's frame (the bind pose: bone⁻¹ · bindMatrix · the tack's point), once per horse */
  private bitsOf(a: Animal): THREE.Vector3[] | null {
    const hit = this.bitLocal.get(a);
    if (hit !== undefined) return hit;
    const sk = a.mesh.skeleton, head = sk.getBoneByName('head');
    if (head === undefined) return null;   // not a horse rig
    const inv = sk.boneInverses[sk.bones.indexOf(head)];
    if (inv === undefined) return null;
    const out = BIT.map((p) => p.clone().applyMatrix4(a.mesh.bindMatrix).applyMatrix4(inv));
    this.bitLocal.set(a, out);
    return out;
  }

  update(dt: number, horse: Animal | null, on: boolean, drop: boolean): void {
    if (!on || horse === null) { this.group.visible = false; this.held = 1; return; }
    const bits = this.bitsOf(horse);
    if (bits === null) { this.group.visible = false; return; }
    this.group.visible = true;
    const cam = this.camera;
    cam.updateMatrixWorld();
    horse.mesh.updateMatrixWorld(true);
    this.held += ((drop ? 0 : 1) - this.held) * Math.min(1, dt * 7);
    // the fist: a fixed spot on screen, sinking out of the frame as the hands let go
    const tanF = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    _hand.set(HAND_NDC.x * HAND_DEPTH * tanF * cam.aspect, HAND_NDC.y * HAND_DEPTH * tanF - (1 - this.held) * 0.3, -HAND_DEPTH);
    this.fist.position.copy(_hand);
    this.fist.visible = this.held > 0.05;
    this.fist.updateMatrix();
    _bottom.copy(this.gripBottom).applyMatrix4(this.fist.matrix);
    // the world → the eye's frame: the withers, the bits, "down" and the horse's left
    const bones = horseBones(horse), toCam = cam.matrixWorldInverse, body = bones.body, head = bones.head;
    _crest.setFromMatrixPosition(bones.mane2.matrixWorld);
    _poll.setFromMatrixPosition(head.matrixWorld);
    _w.copy(WITHERS).applyMatrix4(body.matrixWorld).applyMatrix4(toCam);
    cam.getWorldQuaternion(_q).invert();
    _down.set(0, -1, 0).applyQuaternion(_q);
    _leftW.set(Math.cos(horse.yaw), 0, -Math.sin(horse.yaw));
    for (let r = 0; r < 2; r++) {
      const bit = bits[r];
      if (bit === undefined) continue;
      _b.copy(bit).applyMatrix4(head.matrixWorld).applyMatrix4(toCam);
      // the hand end: the fist's grip (the two reins a finger apart), or the withers when dropped
      _e.copy(_bottom); _e.x += (r === 0 ? -1 : 1) * 0.006;
      _e.lerp(_w, 1 - this.held);
      // the path: a Catmull-Rom from the hand over the crest and past the poll to the bit, each waypoint out on the rein's
      // own side of the neck; dropped, the waypoints sink onto the neck
      const side = r === 0 ? 1 : -1, sink = (1 - this.held) * 0.08;
      _k1.copy(_crest).addScaledVector(_upW, CREST_UP * this.held).addScaledVector(_leftW, side * CREST_OUT).applyMatrix4(toCam).addScaledVector(_down, sink);
      _k2.copy(_poll).addScaledVector(_upW, POLL_UP).addScaledVector(_leftW, side * POLL_OUT).applyMatrix4(toCam);
      _k0.copy(_e).multiplyScalar(2).sub(_k1);           // phantom ends: the path leaves the hand and meets the bit straight
      _k3.copy(_b).multiplyScalar(2).sub(_k2);
      const K = [_k0, _e, _k1, _k2, _b, _k3];
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
        this.pos[k] = _p.x + _s.x; this.pos[k + 1] = _p.y + _s.y; this.pos[k + 2] = _p.z + _s.z;
        this.pos[k + 3] = _p.x - _s.x; this.pos[k + 4] = _p.y - _s.y; this.pos[k + 5] = _p.z - _s.z;
      }
    }
    this.posAttr.needsUpdate = true;
  }
}
