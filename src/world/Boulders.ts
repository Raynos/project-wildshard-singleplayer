/**
 * Boulders — Driftwood Isle's shore boulders: rockKit rocks (smooth painted, E114) sunk into the
 * ground, all in one mesh. Placement is the caller's (a list of
 * `{ x, z, r, rot? }`); `scatterShore()` is the beach rule: rocks along the water line and a few
 * out in the surf, away from the pier corridor.
 *
 *   const rocks = new Boulders(sky).build(Boulders.scatterShore(seed));
 *   scene.add(rocks.mesh); player.colliders.push(...rocks.colliders);
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, waterLevel, inChunk } from './Heightfield';
import { Rng } from '../core/rng';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import type { ColliderDesc } from './registry';
import { TIER_CONFIG } from '../core/tier';
import { WRECK } from '../chunks/driftwood-isle';
import { rockGeometry, rockMaterial, SHORE_ROCK } from './rockKit';

export interface BoulderSpec { x: number; z: number; r: number; rot?: number; squash?: number }

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
    const parts: THREE.BufferGeometry[] = [];
    const rng = new Rng(0x5ea1 ^ 0x70c5);
    for (const b of specs) {
      const g = rockGeometry(b.r, rng, { squash: b.squash ?? 0.7, palette: SHORE_ROCK, moss: rng.range(0.25, 0.85), ground: -0.35 * b.r * (b.squash ?? 0.7) });
      this.place(g, b, parts);
    }
    // an empty scatter (a stale terrain, a def with no land) must not throw in mergeGeometries: an empty mesh instead
    if (parts.length === 0) console.warn('[boulders] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geo, rockMaterial(this.sky));
    this.mesh.castShadow = TIER_CONFIG.boulderShadows; this.mesh.receiveShadow = true;
    return this;
  }

  /** a rockKit rock (centred, non-indexed, painted) posed on its spot: yawed, leaned with the slope, half sunk */
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
