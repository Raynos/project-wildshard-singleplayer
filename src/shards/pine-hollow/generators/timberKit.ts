/**
 * The timber kit's builder (E315 M2; G285: build-time only): the generators of Pine Hollow's timber landmarks
 * (./fireLookout.ts, ./siteTimbers.ts) lay a building's parts in its OWN frame on the cabins' log kit (../world/logKit.ts
 * `logGeo`, `boxUV`), gather its colliders, deck floors and named points, and hand it to the bake (./timberBake.ts); the
 * page finishes the baked parts on the cabins' materials (../world/timber.ts `Timber.baked`, `finish`).
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MatKey } from '../world/homestead';
import { logGeo, boxUV } from '../world/logKit';
import type { Floor, TimberFacts } from '../world/timber';

type V3 = THREE.Vector3;
export const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);

export class TimberBuilder {
  readonly glass: THREE.BufferGeometry[] = [];
  readonly rng: Rng;
  readonly out: ColliderDesc[] = [];
  readonly floors: Floor[] = [];
  readonly anchors: Record<string, V3> = {};
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();

  /** the timber's stream: the level seed (the engine SEED) + `seed` */
  constructor(seed: number) { this.rng = new Rng(SEED + seed); }

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
  facts(): TimberFacts { return { colliders: this.out, floors: this.floors, anchors: this.anchors }; }
  /** what the builder left: each material's parts in order, and the glass */
  built(): { parts: ReadonlyMap<MatKey, readonly THREE.BufferGeometry[]>; glass: readonly THREE.BufferGeometry[] } { return { parts: this.parts, glass: this.glass }; }
}
