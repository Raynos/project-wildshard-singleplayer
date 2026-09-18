/**
 * Hut — the thatched island hut on the plateau (Driftwood Isle). A plank cabin on stilts with a
 * wrap-around porch, a hip roof of golden thatch (two stacked pyramids: eave skirt + cap), a
 * door opening on the front, shuttered windows, a railing and steps. Flat-shaded vertex colours,
 * no textures, one mesh.
 *
 *   const hut = new Hut(sky, { x, z, rot }).build();        // rot: which way the door faces (0 = −z)
 *   scene.add(hut.group); player.colliders.push(...hut.colliders);
 *   player.platforms.push((x, z) => hut.floorHeightAt(x, z)); // porch + floor are walkable
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface HutSpec { x: number; z: number; rot: number }

const C = {
  plank: new THREE.Color('#9c7a52'),
  plankDark: new THREE.Color('#7a5c3c'),
  post: new THREE.Color('#5e4630'),
  thatch: new THREE.Color('#c8a256'),
  thatchDark: new THREE.Color('#a8853f'),
  thatchLight: new THREE.Color('#dcb86a'),
  deck: new THREE.Color('#b08f62'),
  dark: new THREE.Color('#3a2a1c'),
};

const W = 6.4, D = 5.4;              // cabin footprint
const PORCH = 2.2;                    // porch depth around the front and sides
const WALL_H = 2.6;

export class Hut {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  floorY = 0;
  private cos = 1; private sin = 0;

  constructor(private sky: Sky, private spec: HutSpec) { this.cos = Math.cos(spec.rot); this.sin = Math.sin(spec.rot); }

  private toWorld(lx: number, lz: number): [number, number] { return [this.spec.x + lx * this.cos + lz * this.sin, this.spec.z - lx * this.sin + lz * this.cos]; }

  build() {
    const rng = new Rng(SEED ^ 0x4077);
    const parts: THREE.BufferGeometry[] = [];
    const ground = heightAt(this.spec.x, this.spec.z);
    const floorY = ground + 1.1; this.floorY = floorY;
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.06) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    };
    // place a geometry built in hut-local space (x right, z toward the back, door at −z)
    const place = (g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => { g.rotateY(this.spec.rot); const [wx, wz] = this.toWorld(lx, lz); g.translate(wx, ly, wz); return g; };
    const collider = (lx: number, lz: number, hw: number, hd: number, yBottom: number, yTop: number) => {
      const [wx, wz] = this.toWorld(lx, lz);
      this.colliders.push({ x: wx, z: wz, hw, hd, rot: this.spec.rot, yBottom, yTop });
    };

    // ── deck: cabin floor + porch on the front and both sides, plank by plank ──
    const deckW = W + PORCH * 2, deckD = D + PORCH, deckZ = -PORCH / 2;
    for (let px = -deckW / 2; px < deckW / 2; px += 0.42) {
      const g = new THREE.BoxGeometry(0.38, 0.1, deckD);
      add(place(g, px + 0.19, floorY - 0.05 + rng.range(-0.01, 0.01), deckZ), rng.next() < 0.3 ? C.plankDark : C.deck, 0.05);
    }
    // stilts
    for (const [sx, sz] of [[-deckW / 2 + 0.3, -deckD / 2 + deckZ + 0.3], [deckW / 2 - 0.3, -deckD / 2 + deckZ + 0.3], [-deckW / 2 + 0.3, deckD / 2 + deckZ - 0.3], [deckW / 2 - 0.3, deckD / 2 + deckZ - 0.3], [0, -deckD / 2 + deckZ + 0.3], [0, deckD / 2 + deckZ - 0.3], [-deckW / 2 + 0.3, deckZ], [deckW / 2 - 0.3, deckZ]]) {
      const [wx, wz] = this.toWorld(sx, sz);
      const gy = heightAt(wx, wz) - 0.3;
      add(place(new THREE.BoxGeometry(0.28, floorY - gy, 0.28), sx, (floorY + gy) / 2, sz), C.post, 0.05);
    }
    // ── walls (front has the door opening; plank stripes as thin darker bands) ──
    const wallY = floorY + WALL_H / 2;
    const wall = (lx: number, lz: number, w: number, d: number) => { add(place(new THREE.BoxGeometry(w, WALL_H, d), lx, wallY, lz), C.plank, 0.05); collider(lx, lz, w / 2, d / 2, floorY, floorY + WALL_H); };
    const doorW = 1.1;
    wall(-(W / 2 - (W / 2 - doorW / 2) / 2), -D / 2, W / 2 - doorW / 2, 0.16);   // front left
    wall((W / 2 - (W / 2 - doorW / 2) / 2), -D / 2, W / 2 - doorW / 2, 0.16);    // front right
    add(place(new THREE.BoxGeometry(doorW + 0.3, 0.5, 0.18), 0, floorY + WALL_H - 0.25, -D / 2), C.plank, 0.05); // lintel
    wall(0, D / 2, W, 0.16);                                                       // back
    wall(-W / 2, 0, 0.16, D); wall(W / 2, 0, 0.16, D);                             // sides
    // plank lines: thin dark bands every 0.4 m on all four walls
    for (let y = floorY + 0.4; y < floorY + WALL_H - 0.1; y += 0.42) {
      add(place(new THREE.BoxGeometry(W + 0.02, 0.05, 0.02), 0, y, -D / 2 - 0.09), C.plankDark, 0.03);
      add(place(new THREE.BoxGeometry(W + 0.02, 0.05, 0.02), 0, y, D / 2 + 0.09), C.plankDark, 0.03);
      add(place(new THREE.BoxGeometry(0.02, 0.05, D + 0.02), -W / 2 - 0.09, y, 0), C.plankDark, 0.03);
      add(place(new THREE.BoxGeometry(0.02, 0.05, D + 0.02), W / 2 + 0.09, y, 0), C.plankDark, 0.03);
    }
    // dark doorway (an inset panel so the opening reads from afar) + shuttered windows
    add(place(new THREE.BoxGeometry(doorW, WALL_H - 0.5, 0.04), 0, floorY + (WALL_H - 0.5) / 2, -D / 2 + 0.3), C.dark, 0.0);
    for (const sx of [-1, 1]) {
      add(place(new THREE.BoxGeometry(0.9, 0.8, 0.06), sx * 2.0, floorY + 1.5, -D / 2 - 0.1), C.dark, 0.0);
      add(place(new THREE.BoxGeometry(0.42, 0.86, 0.08), sx * 2.0 - 0.68, floorY + 1.5, -D / 2 - 0.12), C.plankDark, 0.04);
      add(place(new THREE.BoxGeometry(0.42, 0.86, 0.08), sx * 2.0 + 0.68, floorY + 1.5, -D / 2 - 0.12), C.plankDark, 0.04);
    }
    // corner posts up to the eave
    for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) add(place(new THREE.BoxGeometry(0.24, WALL_H + 0.3, 0.24), px, floorY + (WALL_H + 0.3) / 2, pz), C.post, 0.05);
    // porch posts holding the eave
    for (const [px, pz] of [[-deckW / 2 + 0.35, -deckD / 2 + deckZ + 0.35], [deckW / 2 - 0.35, -deckD / 2 + deckZ + 0.35], [-deckW / 2 + 0.35, D / 2 - 0.4], [deckW / 2 - 0.35, D / 2 - 0.4]]) {
      add(place(new THREE.BoxGeometry(0.2, WALL_H + 0.2, 0.2), px, floorY + (WALL_H + 0.2) / 2, pz), C.post, 0.05);
      collider(px, pz, 0.12, 0.12, floorY, floorY + WALL_H);
    }
    // ── roof: hip roof from two pyramids — a wide low eave skirt and the steeper cap ──
    const eaveY = floorY + WALL_H + 0.1;
    const pyramid = (w: number, d: number, h: number, y: number, col: THREE.Color, lift = 0) => {
      // four sloped faces from the rectangle at y to the ridge line (a short ridge along x so it isn't a point)
      const ridge = Math.max(0, w - d) / 2;
      const g = new THREE.BufferGeometry();
      const v: number[] = [];
      const A = [-w / 2, y, -d / 2], B = [w / 2, y, -d / 2], Cc = [w / 2, y, d / 2], Dd = [-w / 2, y, d / 2], R1 = [-ridge, y + h, 0], R2 = [ridge, y + h, 0];
      v.push(...A, ...B, ...R2, ...A, ...R2, ...R1);        // front
      v.push(...Cc, ...Dd, ...R1, ...Cc, ...R1, ...R2);     // back
      v.push(...B, ...Cc, ...R2);                           // right
      v.push(...Dd, ...A, ...R1);                           // left
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      // subdivide into thatch bands: just per-face jitter, with the lower faces a shade darker
      add(place(g, 0, lift, 0), col, 0.08);
    };
    // thatch is thick: an underside slab so the eave has depth
    pyramid(deckW + 1.2, deckD + 1.4, 1.5, eaveY, C.thatchDark, 0);
    pyramid(deckW + 1.2, deckD + 1.4, 1.5, eaveY + 0.35, C.thatch, 0);
    pyramid(W + 1.2, D + 1.2, 2.3, eaveY + 1.3, C.thatchLight, 0);
    // ridge cap
    add(place(new THREE.BoxGeometry(Math.max(1, (W + 1.2 - (D + 1.2))) + 0.8, 0.3, 0.5), 0, eaveY + 1.3 + 2.3, 0), C.thatchDark, 0.05);
    // the roof group is centred on the cabin; the eave overhangs the porch in front — shift its centre to the deck centre
    // (done by building the skirt around deckZ: translate the two skirt pyramids)
    for (let i = parts.length - 4; i < parts.length - 2; i++) { const [wx, wz] = this.toWorld(0, deckZ); const [ox, oz] = this.toWorld(0, 0); parts[i].translate(wx - ox, 0, wz - oz); }
    // ── porch railing on the front edge (with a gap for the steps) and the two side edges ──
    const railY = floorY + 0.95;
    const rail = (lx: number, lz: number, len: number, alongX: boolean) => {
      add(place(new THREE.BoxGeometry(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len), lx, railY, lz), C.plankDark, 0.04);
      add(place(new THREE.BoxGeometry(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len), lx, railY - 0.45, lz), C.plankDark, 0.04);
      const n = Math.max(2, Math.round(len / 1.1));
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len * i) / n; add(place(new THREE.BoxGeometry(0.1, 1.0, 0.1), alongX ? lx + t : lx, floorY + 0.5, alongX ? lz : lz + t), C.post, 0.05); }
      collider(lx, lz, alongX ? len / 2 : 0.08, alongX ? 0.08 : len / 2, floorY, railY + 0.1);
    };
    const frontZ = -deckD / 2 + deckZ + 0.12, stepsW = 1.6;
    rail(-(deckW / 4 + stepsW / 4), frontZ, deckW / 2 - stepsW / 2, true);
    rail((deckW / 4 + stepsW / 4), frontZ, deckW / 2 - stepsW / 2, true);
    rail(-deckW / 2 + 0.12, deckZ, deckD - 0.3, false);
    rail(deckW / 2 - 0.12, deckZ, deckD - 0.3, false);
    // ── steps down the front ──
    const stepsZ0 = -deckD / 2 + deckZ;
    const nSteps = 4;
    for (let i = 0; i < nSteps; i++) {
      const y = floorY - (i + 1) * (1.1 / nSteps) + 0.05, z = stepsZ0 - (i + 0.5) * 0.4;
      add(place(new THREE.BoxGeometry(stepsW, 0.1, 0.4), 0, y, z), C.deck, 0.05);
    }
    this.steps = { z0: stepsZ0, len: nSteps * 0.4, w: stepsW };

    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.deck = { w: deckW, d: deckD, z: deckZ };
    return this;
  }

  private deck = { w: 0, d: 0, z: 0 };
  private steps = { z0: 0, len: 0, w: 0 };

  /** deck / floor height under (x, z), the steps ramp down in front, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const lz = dx * this.sin + dz * this.cos, lx = dx * this.cos - dz * this.sin;
    if (Math.abs(lx) <= this.deck.w / 2 && Math.abs(lz - this.deck.z) <= this.deck.d / 2) return this.floorY;
    if (Math.abs(lx) <= this.steps.w / 2 && lz < this.steps.z0 && lz > this.steps.z0 - this.steps.len) {
      const t = (this.steps.z0 - lz) / this.steps.len; // 0 at the deck → 1 at the ground
      return this.floorY - t * 1.1;
    }
    return undefined;
  }
}
