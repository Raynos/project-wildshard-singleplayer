import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { ReinPresentationSchema, type ReinPresentationRows, type ReinRibbonRows, type ReinRibbonFrame } from '@wildshard/format/riding';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { object, parse } from 'valibot';

import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';

/** Purely numeric presentation envelopes, independent of a species or rig. */
export interface RidingPresentationRows {
  alive: string; smooth: readonly { source: string; target: string; rate: number; low: number; high: number }[];
  decay: readonly { source: string; target: string; rate: number }[];
  graze: { target: string; rate: number; speed: number };
  base: { bone: string; target: string }; wind: { x: string; z: string; strength: string };
}
/** Native joints and client rigs consume the same declared envelopes before their
 * existing numeric pose program. This advances presentation only. */
export function poseRidingEnvelopes(context: AnimalRigContext, rows: RidingPresentationRows, wind: { x: number; z: number; strength: number }): void {
  const memory = context.mem;
  memory[rows.alive] = Number(context.alive);
  for (const row of rows.smooth) {
    const target = context.alive ? Math.min(row.high, Math.max(row.low, memory[row.source] ?? 0)) : 0;
    memory[row.target] = (memory[row.target] ?? 0) + (target - (memory[row.target] ?? 0)) * Math.min(1, context.dt * row.rate);
  }
  for (const row of rows.decay) {
    const value = memory[row.source] ?? 0; memory[row.target] = value;
    if (value > 0) memory[row.source] = Math.max(0, value - context.dt * row.rate);
  }
  const graze = context.alive && context.state === 'graze' && context.speed < rows.graze.speed ? 1 : 0;
  memory[rows.graze.target] = (memory[rows.graze.target] ?? 0) + (graze - (memory[rows.graze.target] ?? 0)) * Math.min(1, context.dt * rows.graze.rate);
  memory[rows.base.target] ??= context.bones[rows.base.bone]?.position.z ?? 0;
  memory[rows.wind.x] = wind.x; memory[rows.wind.z] = wind.z; memory[rows.wind.strength] = wind.strength;
}

function rgb(value: readonly number[]): [number, number, number] {
  const [r, g, b] = value;
  if (value.length !== 3 || r === undefined || g === undefined || b === undefined || !value.every(Number.isFinite)) throw new Error('Invalid rein colour');
  return [r, g, b];
}

const _w = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _down = new THREE.Vector3(), _q = new THREE.Quaternion();
const _k0 = new THREE.Vector3(), _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _k3 = new THREE.Vector3(), _head = new THREE.Vector3();
const _crest = new THREE.Vector3(), _leftW = new THREE.Vector3(), _upW = new THREE.Vector3(0, 1, 0), _muzzle = new THREE.Vector3();

/** a uniform Catmull-Rom point (or its tangent) between p1 and p2 at t, into `out` */
function catmull(out: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, tangent: boolean): THREE.Vector3 {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number => tangent
    ? 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2)
    : 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}

/** Client-only paired, vertex-coloured straps; the caller owns the returned geometry and material. */
export function buildReinsRibbon(rows: ReinRibbonRows): { mesh: THREE.Mesh; pos: Float32Array; attr: THREE.BufferAttribute } {
  if (!Number.isInteger(rows.span) || rows.span < 1 || rows.span > 64 || !Number.isFinite(rows.halfWidth) || rows.halfWidth <= 0) throw new Error('Invalid rein dimensions');
  const SEG = rows.span * 3;
  const LEATHER = new THREE.Color(...rgb(rows.colour)), LEATHER_EDGE = new THREE.Color(...rgb(rows.edge));
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
  return { mesh: new THREE.Mesh(g, painterlyMaterial(null, { ...rows.paint, side: THREE.DoubleSide })), pos, attr };
}

/** Fill one strap along six camera-space anchors, including the two phantom endpoints. */
export function fillRein(pos: Float32Array, r: number, K: readonly THREE.Vector3[], rows: ReinRibbonRows): void {
  const SPAN = rows.span, SEG = SPAN * 3;
  const o = r * (SEG + 1) * 2;
  for (let i = 0; i <= SEG; i++) {
    const span = Math.min(2, Math.floor(i / SPAN)), t = (i - span * SPAN) / SPAN;
    const p0 = K[span], p1 = K[span + 1], p2 = K[span + 2], p3 = K[span + 3];
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) continue;
    catmull(_p, p0, p1, p2, p3, t, false);
    catmull(_t, p0, p1, p2, p3, t, true);
    // a flat strap turned to the eye: its width across the tangent and the line of sight
    _s.crossVectors(_t, _p).normalize().multiplyScalar(rows.halfWidth);
    const k = (o + i * 2) * 3;
    pos[k] = _p.x + _s.x; pos[k + 1] = _p.y + _s.y; pos[k + 2] = _p.z + _s.z;
    pos[k + 3] = _p.x - _s.x; pos[k + 4] = _p.y - _s.y; pos[k + 5] = _p.z - _s.z;
  }
}

/** Client-only camera projection. All mount observations and appearance are numeric rows. */
export class ReinRibbon {
  readonly group = new THREE.Group();
  private readonly pos: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly ribbon: THREE.Mesh;
  /** 1 = in the hands, 0 = dropped on the withers (eased) */
  private held = 1;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly rows: ReinRibbonRows, scope?: Scope) {
    const { mesh, pos, attr } = buildReinsRibbon(rows);
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

  update(dt: number, frame: ReinRibbonFrame | null): void {
    if (frame === null) { this.group.visible = false; this.held = 1; return; }
    this.group.visible = true;
    const cam = this.camera, rows = this.rows;
    cam.updateMatrixWorld();
    this.held += ((frame.drop ? 0 : 1) - this.held) * Math.min(1, dt * rows.heldRate);
    const toCam = cam.matrixWorldInverse;
    _crest.fromArray(frame.crest); _head.fromArray(frame.head); _muzzle.fromArray(frame.muzzle);
    _w.fromArray(frame.withers).applyMatrix4(toCam);
    cam.getWorldQuaternion(_q).invert();
    _down.set(0, -1, 0).applyQuaternion(_q);
    _leftW.set(Math.cos(frame.yaw), 0, -Math.sin(frame.yaw));
    const tanF = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    for (let r = 0; r < 2; r++) {
      const side = r === 0 ? 1 : -1;   // r 0 = the horse's left rein (on the screen's left: the view looks along the horse)
      // the bit: back from the muzzle toward the head bone, out to this side of the mouth
      _b.copy(_muzzle).lerp(_head, rows.bit.back).addScaledVector(_leftW, side * rows.bit.out).applyMatrix4(toCam);
      // the hand: under the frame on this side, or the withers when the hands let go
      _e.set(-side * rows.hand.x * rows.hand.depth * tanF * cam.aspect, rows.hand.y * rows.hand.depth * tanF, -rows.hand.depth).lerp(_w, 1 - this.held);
      // the neck's flank, then under the jowl — out on this side; dropped, the neck point sinks onto the neck
      _k1.copy(_crest).addScaledVector(_upW, -rows.neck.down).addScaledVector(_leftW, side * rows.neck.out).applyMatrix4(toCam).addScaledVector(_down, (1 - this.held) * rows.droppedSag);
      _k2.copy(_head).addScaledVector(_upW, -rows.jowl.down).addScaledVector(_leftW, side * rows.jowl.out).applyMatrix4(toCam);
      _k0.copy(_e).multiplyScalar(2).sub(_k1);           // phantom ends: the path leaves the hand and meets the bit straight
      _k3.copy(_b).multiplyScalar(2).sub(_k2);
      fillRein(this.pos, r, [_k0, _e, _k1, _k2, _b, _k3], rows);
    }
    this.posAttr.needsUpdate = true;
  }
}

/** Client-only Explorer presentation using the same admitted strap rows as a rider. */
export function reinSpecimen(rows: { id: string; name: string; file: string; product: { slug: string; path: string };
  crest: readonly [number, number, number]; head: readonly [number, number, number]; muzzle: readonly [number, number, number];
  fov: number; aspect: number }): ModelDef<object> {
  let profile: ReinPresentationRows | null = null;
  return defineModel<object>({ id: rows.id, name: rows.name, file: rows.file, category: 'gear', pipeline: 'code', defaults: {},
    prepare: async () => {
      const { loadFirstPartyProduct } = await import('../shardfile/runtimeProduct');
      const product = await loadFirstPartyProduct(rows.product.slug);
      profile = parse(object({ reins: ReinPresentationSchema }), await product.json(rows.product.path)).reins;
    },
    build: () => {
      if (profile === null) throw new Error('Rein specimen rows are not prepared');
      const { mesh, pos } = buildReinsRibbon(profile), tan = Math.tan(THREE.MathUtils.degToRad(rows.fov) / 2);
      const crest = new THREE.Vector3(...rows.crest), head = new THREE.Vector3(...rows.head), muzzle = new THREE.Vector3(...rows.muzzle);
      const left = new THREE.Vector3(-1, 0, 0), up = new THREE.Vector3(0, 1, 0);
      for (let r = 0; r < 2; r++) {
        const side = r === 0 ? 1 : -1;
        const bit = muzzle.clone().lerp(head, profile.bit.back).addScaledVector(left, side * profile.bit.out);
        const hand = new THREE.Vector3(-side * profile.hand.x * profile.hand.depth * tan * rows.aspect, profile.hand.y * profile.hand.depth * tan, -profile.hand.depth);
        const neck = crest.clone().addScaledVector(up, -profile.neck.down).addScaledVector(left, side * profile.neck.out);
        const jowl = head.clone().addScaledVector(up, -profile.jowl.down).addScaledVector(left, side * profile.jowl.out);
        fillRein(pos, r, [hand.clone().multiplyScalar(2).sub(neck), hand, neck, jowl, bit, bit.clone().multiplyScalar(2).sub(jowl)], profile);
      }
      mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere(); mesh.castShadow = true;
      const box = mesh.geometry.boundingBox ?? new THREE.Box3();
      mesh.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const holder = new THREE.Group(); holder.name = 'reins'; holder.add(mesh); return holder;
    },
  });
}
