/**
 * Boulders — grey faceted low-poly rocks for Driftwood Isle: jittered icosahedra sunk into the
 * ground, flat-shaded vertex colours, all in one mesh. Placement is the caller's (a list of
 * `{ x, z, r, rot? }`); `scatterShore()` is the beach rule: rocks along the water line and a few
 * out in the surf, away from the pier corridor.
 *
 *   const rocks = new Boulders(sky).build(Boulders.scatterShore(seed));
 *   scene.add(rocks.mesh); player.colliders.push(...rocks.colliders);
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, waterLevel, inChunk } from './Heightfield';
import { Rng } from '../core/rng';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import type { ColliderDesc } from './registry';
import { TIER_CONFIG } from '../core/tier';
import { WRECK } from '../chunks/driftwood-isle';
import { rockLook, rockGeometry, rockMaterial, SHORE_ROCK } from './rockKit';

export interface BoulderSpec { x: number; z: number; r: number; rot?: number; squash?: number }

const ROCK = new THREE.Color('#7a7e84'), ROCK_LIGHT = new THREE.Color('#9da1a7'), ROCK_DARK = new THREE.Color('#565a60');

export class Boulders {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  count = 0;
  /** PHYSICS P4: a convex hull of each colliding rock's drawn vertices (see colliderDescs) */
  private hulls: ColliderDesc[] = [];

  constructor(private sky: Sky) {}

  /**
   * Beach rule: walk the shoreline (where the ground crosses the water line) and drop rocks in
   * clusters — most on the sand just above the line, some in the shallows — skipping the
   * entry-road corridors so the piers stay clear.
   */
  static scatterShore(seed: number, count = 110): BoulderSpec[] {
    const rng = new Rng(seed ^ 0x0b0c);
    const wl = waterLevel();
    const out: BoulderSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20), z = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20);
      if (!inChunk(x, z, 15)) continue;
      const h = heightAt(x, z) - wl;
      if (h < -2.2 || h > 2.4) continue;                                      // the surf / the beach band only
      if (Math.abs(x) < ROAD_WIDTH / 2 + 8 && Math.abs(z) > 150) continue;    // N/S pier corridors
      if (Math.abs(z) < ROAD_WIDTH / 2 + 8 && Math.abs(x) > 150) continue;    // E/W
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.r + 2.5) * 1.6)) continue;
      const big = rng.next() < 0.3;
      const r = big ? rng.range(2.6, 4.6) : rng.range(0.9, 2.0);
      out.push({ x, z, r, rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.85) });
      // a cluster: one or two smaller ones beside a big one
      if (big) for (let k = 0; k < rng.int(1, 3); k++) {
        const a = rng.range(0, Math.PI * 2), d = r + rng.range(0.8, 2.2);
        out.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: rng.range(0.5, 1.2), rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.8) });
      }
    }
    // the wreck brings its own reef rocks and needs its beach side (the breach, the ramp) clear
    return out.filter((b) => Math.hypot(b.x - WRECK.x, b.z - WRECK.z) > 16 + b.r);
  }

  build(specs: BoulderSpec[]): this {
    const rng = new Rng(0x5ea1 ^ 0xb0);
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Color();
    // E114: the rocks are built in rockKit's look — B (smooth painted) by default, ?rocks=now the old icosahedra below
    const look = rockLook(), lookRng = new Rng(0x5ea1 ^ 0x70c5);
    for (const b of specs) {
      if (look !== 'current') {
        const g = rockGeometry(look, b.r, lookRng, { squash: b.squash ?? 0.7, palette: SHORE_ROCK, moss: lookRng.range(0.25, 0.85), ground: -0.35 * b.r * (b.squash ?? 0.7) });
        this.place(g, b, parts);
        continue;
      }
      const detail = b.r > 2 ? 1 : 0;
      // IcosahedronGeometry is NON-indexed (every face owns its corners): weld it first, or each face's copy of a
      // corner takes its own jitter and the faces split into see-through cracks (E114)
      const ico = new THREE.IcosahedronGeometry(b.r, detail);
      ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
      const g = mergeVertices(ico);
      ico.dispose();
      const pos = g.getAttribute('position');
      // jitter the (shared) vertices radially, then squash — on the welded sphere so faces stay closed
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const k = 1 + (rng.next() - 0.5) * 0.26;
        v.multiplyScalar(k);
        v.y *= b.squash ?? 0.7;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      g.rotateY(b.rot ?? 0);
      const y = heightAt(b.x, b.z);
      const [nx, , nz] = normalAt(b.x, b.z, 1.5);
      g.rotateX(nz * 0.6); g.rotateZ(-nx * 0.6); // lean with the slope a little
      g.translate(b.x, y + b.r * (b.squash ?? 0.7) * 0.35, b.z);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.getAttribute('position').count, col = new Float32Array(n * 3);
      const p = ni.getAttribute('position');
      for (let i = 0; i < n; i += 3) {
        // facet colour: lighter on up-facing faces, darker down low (wet), a little jitter
        const ay = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 - y;
        const up = THREE.MathUtils.clamp((ay / Math.max(0.3, b.r)) * 0.8 + 0.4, 0, 1);
        c.lerpColors(ROCK_DARK, ROCK_LIGHT, up).lerp(ROCK, 0.35).multiplyScalar(0.9 + rng.next() * 0.2);
        for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b; }
      }
      ni.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(ni);
      this.collide(b, y, p);
      this.count++;
    }
    // an empty scatter (a stale terrain, a def with no land) must not throw in mergeGeometries: an empty mesh instead
    if (parts.length === 0) console.warn('[boulders] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    let mat: THREE.MeshStandardMaterial;
    if (look === 'current') {
      mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
      this.sky.setupMaterial(mat);
    } else mat = rockMaterial(this.sky, look);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = TIER_CONFIG.boulderShadows; this.mesh.receiveShadow = true;
    return this;
  }

  /** a rockKit rock (centred, non-indexed, painted) posed like the current ones: yawed, leaned with the slope, half sunk */
  private place(g: THREE.BufferGeometry, b: BoulderSpec, parts: THREE.BufferGeometry[]): void {
    g.rotateY(b.rot ?? 0);
    const y = heightAt(b.x, b.z);
    const [nx, , nz] = normalAt(b.x, b.z, 1.5);
    g.rotateX(nz * 0.6); g.rotateZ(-nx * 0.6);
    g.translate(b.x, y + b.r * (b.squash ?? 0.7) * 0.35, b.z);
    parts.push(g);
    this.collide(b, y, g.getAttribute('position'));
    this.count++;
  }

  /** a rock over 0.9 m collides: the legacy box, and a hull of the vertices it draws (relative to its centre) */
  private collide(b: BoulderSpec, y: number, p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): void {
    if (b.r <= 0.9) return;
    this.colliders.push({ x: b.x, z: b.z, hw: b.r * 0.8, hd: b.r * 0.8, rot: b.rot ?? 0, yTop: y + b.r * 1.2, yBottom: y - 2 });
    const cy = y + b.r * (b.squash ?? 0.7) * 0.35, pts = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { pts[i * 3] = p.getX(i) - b.x; pts[i * 3 + 1] = p.getY(i) - cy; pts[i * 3 + 2] = p.getZ(i) - b.z; }
    this.hulls.push({ kind: 'hull', x: b.x, y: cy, z: b.z, points: pts });
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — each rock that has a legacy box (r > 0.9 m; the
   * small ones stay walk-through, as today) as a convex hull of the vertices it draws. The boxes stay in `colliders`
   * for the melee sweep and foam. src/physics/pieces.ts turns it into Rapier colliders. Rocks have no floors.
   */
  colliderDescs(): ColliderDesc[] { return this.hulls.slice(); }
}
