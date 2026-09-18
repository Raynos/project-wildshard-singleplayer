/**
 * Pier — a low-poly wooden jetty on pilings (Driftwood Isle's south entry). Flat-shaded
 * vertex-coloured geometry, no textures; one mesh, one draw call.
 *
 *   const pier = new Pier(sky, { x: 0, z: -250, length: 60, width: 4, deckY: 1.8 }).build();
 *   scene.add(pier.group);
 *   player.colliders.push(...pier.colliders);              // posts + the raised mooring bollards
 *   player.platforms.push((x, z) => pier.floorHeightAt(x, z)); // the deck is walkable
 *   player.position.y = pier.deckY;                         // spawning on it: Player.spawn() uses the terrain height
 *
 * The pier runs from (x, z) toward +z (north) for `length` metres. `floorHeightAt` returns the
 * deck's top for any (x, z) over the deck, else undefined — same contract as `Cabins`.
 * `bollards` are the two tall rope-wrapped posts at the sea end (the sailboat moors to them);
 * `posts` every piling. `mooringsFor(x, z)` picks the bollard and the piling nearest a boat moored
 * alongside at (x, z) — pass it as `Boat.moorTo`.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '../player/Player';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Sky } from './Sky';

export interface PierSpec {
  x: number; z: number;
  /** metres along +z from (x, z) */
  length: number;
  /** deck width, metres */
  width: number;
  /** world y of the deck top */
  deckY: number;
  /** direction along the pier in radians about +y (0 = +z); the sea end is at (x, z) */
  rot?: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  pileDepth?: number;
}

const C = {
  plank: new THREE.Color('#9a7a56'),
  plankLight: new THREE.Color('#b08d64'),
  plankDark: new THREE.Color('#7c6244'),
  post: new THREE.Color('#6f5638'),
  postTop: new THREE.Color('#8a6d48'),
  rope: new THREE.Color('#d8c48a'),
  ropeDark: new THREE.Color('#b59e6a'),
};

export class Pier {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  /** the two tall mooring posts at the sea end, world xz */
  bollards: { x: number; z: number }[] = [];
  /** every piling along the deck, world xz (mooring lines, gulls…) */
  posts: { x: number; z: number }[] = [];
  readonly deckY: number;
  private cos: number; private sin: number;

  constructor(private sky: Sky, private spec: PierSpec) {
    this.deckY = spec.deckY;
    const r = spec.rot ?? 0;
    this.cos = Math.cos(r); this.sin = Math.sin(r);
  }

  /** local (along, across) → world */
  private toWorld(along: number, across: number): [number, number] {
    return [this.spec.x + across * this.cos + along * this.sin, this.spec.z - across * this.sin + along * this.cos];
  }

  build() {
    const { length, width, deckY } = this.spec;
    const pileDepth = this.spec.pileDepth ?? 8;
    const rng = new Rng(SEED ^ 0x9e37);
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.08) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const nonIdx = g.index ? g.toNonIndexed() : g;
      const n = nonIdx.attributes.position.count;
      const c = new Float32Array(n * 3);
      // one shade per face (every 3 vertices) so the facets read
      for (let i = 0; i < n; i += 3) {
        const k = 1 - jitter + rng.next() * jitter * 2;
        for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; }
      }
      nonIdx.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(nonIdx);
    };
    const place = (g: THREE.BufferGeometry, along: number, across: number, y: number, rotY = 0) => {
      const [wx, wz] = this.toWorld(along, across);
      g.rotateY((this.spec.rot ?? 0) + rotY);
      g.translate(wx, y, wz);
      return g;
    };

    // ── deck planks across the pier, slightly uneven ──
    const plankW = 0.36, gap = 0.05, thick = 0.12;
    const bearerY = deckY - thick - 0.16;
    for (let a = 0; a < length; a += plankW + gap) {
      const w = width + 0.3 + rng.range(-0.06, 0.06);
      const g = new THREE.BoxGeometry(w, thick, plankW);
      const dy = rng.range(-0.015, 0.015), tilt = rng.range(-0.012, 0.012);
      g.rotateZ(tilt);
      const shade = rng.next();
      add(place(g, a + plankW / 2, rng.range(-0.03, 0.03), deckY - thick / 2 + dy), shade < 0.2 ? C.plankDark : shade > 0.8 ? C.plankLight : C.plank, 0.06);
    }
    // ── two bearers (stringers) under the planks, full length ──
    for (const s of [-1, 1]) add(place(new THREE.BoxGeometry(0.22, 0.28, length + 0.4), length / 2, s * (width / 2 - 0.35), bearerY), C.plankDark, 0.05);

    // ── pilings every 3 m each side, cross braces, rope wraps at the top ──
    const postR = 0.17, postTop = deckY + 0.95;
    for (let a = 1.2; a < length; a += 3.0) {
      for (const s of [-1, 1]) {
        const across = s * (width / 2 + 0.1);
        const h = postTop - (deckY - pileDepth);
        const g = new THREE.CylinderGeometry(postR * 0.9, postR * 1.15, h, 7);
        g.rotateY(rng.range(0, Math.PI));
        add(place(g, a, across, (postTop + deckY - pileDepth) / 2, 0), C.post, 0.07);
        // cap
        add(place(new THREE.CylinderGeometry(postR * 0.95, postR * 0.95, 0.1, 7), a, across, postTop + 0.02), C.postTop, 0.05);
        // rope wrap: three short 8-sided bands just under the cap (a torus each was 100 tris; the pier is drawn twice with shadows)
        for (let r = 0; r < 3; r++) add(place(new THREE.CylinderGeometry(postR + 0.06, postR + 0.06, 0.08, 8), a, across, postTop - 0.16 - r * 0.1), r === 1 ? C.ropeDark : C.rope, 0.04);
        const [wx, wz] = this.toWorld(a, across);
        this.posts.push({ x: wx, z: wz });
        this.colliders.push({ x: wx, z: wz, hw: postR + 0.04, hd: postR + 0.04, rot: -(this.spec.rot ?? 0), yTop: postTop, yBottom: deckY - 1 });
      }
      // cross brace under the deck between the two posts
      const b = new THREE.BoxGeometry(width + 0.4, 0.12, 0.12);
      add(place(b, a, 0, bearerY - 0.3), C.plankDark, 0.05);
    }

    // ── mooring bollards at the sea end: two thicker, taller posts with a heavy rope wrap ──
    for (const s of [-1, 1]) {
      const across = s * (width / 2 + 0.25);
      const top = deckY + 1.35;
      const g = new THREE.CylinderGeometry(0.24, 0.28, top - (deckY - pileDepth), 8);
      add(place(g, 0.35, across, (top + deckY - pileDepth) / 2), C.post, 0.06);
      add(place(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 8), 0.35, across, top + 0.03), C.postTop, 0.05);
      for (let r = 0; r < 5; r++) add(place(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 8), 0.35, across, top - 0.22 - r * 0.11), r % 2 ? C.ropeDark : C.rope, 0.04);
      const [wx, wz] = this.toWorld(0.35, across);
      this.bollards.push({ x: wx, z: wz });
      this.colliders.push({ x: wx, z: wz, hw: 0.32, hd: 0.32, rot: -(this.spec.rot ?? 0), yTop: top, yBottom: deckY - 1 });
    }
    // ── the sea end: a low kick board so the deck reads as an end, not a cut ──
    add(place(new THREE.BoxGeometry(width + 0.3, 0.22, 0.14), 0.02, 0, deckY + 0.05), C.plankDark, 0.05);

    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    return this;
  }

  /** [bollard, piling] on the side of (x, z) for a boat moored alongside — bow line and stern line */
  mooringsFor(x: number, z: number, sternZ = z + 3): { x: number; z: number }[] {
    const side = (x - this.spec.x) * this.cos - (z - this.spec.z) * this.sin < 0 ? -1 : 1;
    const onSide = (p: { x: number; z: number }) => Math.sign((p.x - this.spec.x) * this.cos - (p.z - this.spec.z) * this.sin) === side;
    const bollard = this.bollards.find(onSide) ?? this.bollards[0];
    let post = this.posts[0], best = Infinity;
    for (const p of this.posts) { if (!onSide(p)) continue; const d = Math.hypot(p.x - x, p.z - sternZ); if (d < best) { best = d; post = p; } }
    return [bollard, post];
  }

  /** world y of the deck under (x, z), or undefined off the pier */
  floorHeightAt(x: number, z: number): number | undefined {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    const along = dx * this.sin + dz * this.cos, across = dx * this.cos - dz * this.sin;
    if (along < -0.2 || along > this.spec.length + 0.2 || Math.abs(across) > this.spec.width / 2 + 0.25) return undefined;
    return this.deckY;
  }
}
