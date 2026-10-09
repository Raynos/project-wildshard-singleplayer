/**
 * The timber kit Pine Hollow's landmark models are built with (E315 M2; moved from src/shards/pine-hollow/world/landmarks.ts): a
 * building's parts in its OWN frame, on the cabins' own kit and materials (src/engine/world/Cabin.ts `cabinMats`, `logGeo`,
 * `boxUV`, `finishParts`): one merged mesh per material, two position-only shadow proxies, no new programs. Its
 * colliders and deck floors are gathered in the same frame; `place` carries them to the placement.
 *
 * A finished timber tags its detail set (iron, cloth, chinking, glass: `userData.until` = the cabins' detail distance +
 * its pad) and its far set (end grain, bark, doors and their shadow proxy: twice that), which `place`'s single draw
 * drops with distance — the old PineLandmarks.update, as data.
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { cabinMats, type Mats, type MatKey } from './homestead';
import { finishParts, logGeo, boxUV } from '../models/logCabin';

type V3 = THREE.Vector3;
export const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);

/** a walkable deck rectangle: centre, turn, half extents, height (own space, or world once placed) */
export interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }

/** what a built timber knows besides its drawing: its colliders and floors (own space) and its named points */
export interface TimberFacts {
  readonly colliders: readonly ColliderDesc[];
  readonly floors: readonly Floor[];
  readonly anchors: Readonly<Record<string, V3>>;
}

export class Timber {
  readonly root = new THREE.Group();
  readonly detail: THREE.Object3D[] = [];
  readonly far: THREE.Object3D[] = [];
  readonly glass: THREE.BufferGeometry[] = [];
  readonly rng: Rng;
  readonly out: ColliderDesc[] = [];
  readonly floors: Floor[] = [];
  readonly anchors: Record<string, V3> = {};
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();

  constructor(name: string, seed: number) {
    this.rng = new Rng(SEED + seed);
    this.root.name = name;
  }

  add(key0: MatKey, geo: THREE.BufferGeometry, m?: THREE.Matrix4): void {
    if (m) geo.applyMatrix4(m);
    const g = geo.index ? geo.toNonIndexed() : geo;
    // fewer materials, fewer draws (a landmark is mostly seen from afar): the decks are the beams' planks
    const key: MatKey = key0 === 'deck' ? 'beam' : key0;
    const list = this.parts.get(key);
    if (list === undefined) this.parts.set(key, [g]); else list.push(g);
  }
  /** a box of w × h × d centred at (x, y, z), turned ry about +Y (then rz, rx) */
  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, uv = 1, ry = 0, rz = 0, rx = 0): void {
    const g = boxUV(new THREE.BoxGeometry(w, h, d), uv, this.rng.next(), this.rng.next());
    this.m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
    this.add(key, g, this.m);
  }
  /** a round log from a to b (peeled 'log' texture, or 'bark') with end grain caps */
  log(a: V3, b: V3, r: number, key: 'log' | 'bark' = 'log', segs = 10): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    if (len < 0.02) return;
    const { side, caps } = logGeo(len, r, this.rng.int(0, 6), this.rng.range(0, 2), segs, key === 'bark');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5));
    this.add(key, side, m.clone());
    this.add(key, caps, m); // the caps in the log's own material: one draw per landmark for its logs
  }
  /** a sawn beam (square section `s`) from a to b */
  beam(a: V3, b: V3, s: number, key: MatKey = 'beam'): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = boxUV(new THREE.BoxGeometry(len, s, s), 1, this.rng.next(), this.rng.next());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    this.add(key, g, new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5)));
  }
  /** a static box collider: centre (lx, lz), half extents, from y0 to y1 above the frame's origin */
  solid(lx: number, lz: number, hx: number, hz: number, y0: number, y1: number, localYaw = 0, surface: 'wood' | 'stone' = 'wood'): void {
    this.out.push({ kind: 'box', x: lx, y: (y0 + y1) / 2, z: lz, hx, hy: (y1 - y0) / 2, hz, yaw: localYaw, surface });
  }
  /** a box collider along a sloped segment a → b (a leg, a deck on a slope): `hw` across (±Z of the segment), `hh` thick */
  solidAlong(a: V3, b: V3, hw: number, hh: number): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
    const mid = a.clone().lerp(b, 0.5);
    this.out.push({ kind: 'box', x: mid.x, y: mid.y, z: mid.z, hx: len / 2, hy: hh, hz: hw, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w }, surface: 'wood' });
  }
  /** a stair (Rapier treads): `count` risers from `from` (the first tread's foot) to `to` (the top edge) */
  treads(from: V3, to: V3, width: number, count: number): void {
    this.out.push({ kind: 'treads', from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z }, width, count, surface: 'wood' });
  }
  /** a walkable deck rectangle for `floorHeightAt` (placement only: the colliders are the real floor) */
  floor(lx: number, lz: number, hw: number, hd: number, y: number): void {
    this.floors.push({ x: lx, z: lz, rot: 0, hw, hd, y });
  }
  /**
   * Merge the parts per material, add the glass, and tag what drops with distance: the detail set within the cabins'
   * detail distance + `pad`, the far set within twice it (+ `pad`); the detail's shadows off on a tier without them.
   */
  finish(mats: Mats, pad: number): THREE.Group {
    finishParts(this.parts, mats, this.root, this.detail, this.far);
    if (this.glass.length > 0) {
      const merged = this.glass.length === 1 ? this.glass[0] : mergeList(this.glass);
      if (merged) {
        const gm = new THREE.Mesh(merged, mats.glass);
        gm.renderOrder = 2; gm.receiveShadow = true;
        this.root.add(gm); this.detail.push(gm);
      }
    }
    if (!TIER_CONFIG.cabinDetailShadows) for (const o of this.detail) o.traverse((c) => { c.castShadow = false; });
    const dd = TIER_CONFIG.cabinDetailDist;
    for (const o of this.detail) o.userData['until'] = dd + pad;
    for (const o of this.far) o.userData['until'] = dd * 2 + pad;
    return this.root;
  }
  facts(): TimberFacts { return { colliders: this.out, floors: this.floors, anchors: this.anchors }; }
}

function mergeList(list: THREE.BufferGeometry[]): THREE.BufferGeometry | undefined {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
  }
  if (pos.length === 0) return undefined;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

const MATS = 'pine-hollow/timber:mats';

/** Load the timber's materials (the cabins') into this shard's context. */
export async function loadTimber(ctx: ModelContext): Promise<void> {
  const mats = await cabinMats(ctx.sky);
  ctx.once(MATS, () => mats);
}

export const timberMats = (ctx: ModelContext): Mats => ctx.once<Mats>(MATS, () => { throw new Error('[timber] loadTimber(ctx) first'); });

/**
 * A timber model's build and its facts, keyed by the copy's params (one build per copy: `place` builds, then asks for
 * the colliders with the same params; the world then asks for the floors and anchors). `make` builds and finishes it;
 * `keyOf` picks what identifies a copy (a site-fitted one: its ground function — `place` merges the params into a new
 * object).
 */
export function timberFacts<P extends object>(make: (ctx: ModelContext, p: P) => Timber, keyOf: (p: P) => object = (p) => p): { build: (ctx: ModelContext, p: P) => THREE.Group; facts: (ctx: ModelContext, p: P) => TimberFacts } {
  const known = new WeakMap<object, TimberFacts>();
  return {
    build: (ctx, p) => { const t = make(ctx, p); if (!known.has(keyOf(p))) known.set(keyOf(p), t.facts()); return t.root; },
    facts: (ctx, p) => { let f = known.get(keyOf(p)); if (f === undefined) { f = make(ctx, p).facts(); known.set(keyOf(p), f); } return f; },
  };
}

/** a placed timber's frame (the transform its old world-space builder used): position, then a turn about +Y */
export function timberFrame(x: number, y: number, z: number, yaw: number): THREE.Matrix4 {
  const root = new THREE.Object3D();
  root.position.set(x, y, z);
  root.rotation.y = yaw;
  root.updateMatrixWorld(true);
  return root.matrixWorld.clone();
}

/** own-space floors carried to a frame (world space, as `floorHeightAt` reads them) */
export function placeFloors(floors: readonly Floor[], frame: THREE.Matrix4, yaw: number): Floor[] {
  return floors.map((f) => { const c = V(f.x, f.y, f.z).applyMatrix4(frame); return { x: c.x, z: c.z, rot: yaw + f.rot, hw: f.hw, hd: f.hd, y: c.y }; });
}
