/**
 * Bushes — Driftwood Isle's hibiscus shrubs: the leaf clump (bushKit.ts, the user's E116 pick), a quarter of them in
 * flower. One flat-shaded vertex-coloured mesh on the shared lowPolyMaterial, no colliders (you walk through them).
 *
 *   const bushes = new Bushes(sky).build(Bushes.scatterIsland(seed));
 *   scene.add(bushes.mesh);
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, waterLevel, inChunk } from './Heightfield';
import { Rng } from '../core/rng';
import { Noise2D } from '../core/noise';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { swayDepthMaterial } from './wind';
import { lowPolyMaterial } from './lowpolyKit';
import { bushParts } from './bushKit';

export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

export class Bushes {
  mesh!: THREE.Mesh;
  count = 0;
  /** what was built (the board's in-world camera finds a patch from these) */
  readonly specs: BushSpec[] = [];

  constructor(private sky: Sky) {}

  static scatterIsland(seed: number, count = TIER_CONFIG.bushCount, avoid: { x: number; z: number; r: number }[] = []): BushSpec[] {
    const rng = new Rng(seed ^ 0xb054), clump = new Noise2D(seed + 33);
    const wl = waterLevel();
    const out: BushSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.5) continue;
      const [, ny] = normalAt(x, z, 1.2);
      if (ny < 0.88) continue;
      const c = clump.fbm(x * 0.02, z * 0.02, 2);
      const beachTop = h < 3.0 ? 0.5 : 0;
      if (rng.next() > Math.max(beachTop, (c + 0.4) * 0.8)) continue;
      if (Math.abs(x) < ROAD_WIDTH / 2 + 4 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 4 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 2.2)) continue;
      out.push({ x, z, r: rng.range(0.7, 1.5), flowers: rng.next() < 0.28 });
    }
    return out;
  }

  build(specs: BushSpec[]): this {
    this.specs.push(...specs);
    const rng = new Rng(0x5ea1 ^ 0xb5 ^ 0xe116);
    const parts: THREE.BufferGeometry[] = [];
    for (const b of specs) { parts.push(...bushParts(b, heightAt(b.x, b.z), rng)); this.count++; }
    // an empty scatter (a stale terrain, a def with no land) must not throw in mergeGeometries: an empty mesh instead
    if (parts.length === 0) console.warn('[bushes] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    for (const p of parts) p.dispose();
    geo.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    this.mesh.castShadow = TIER_CONFIG.bushShadows; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = swayDepthMaterial();
    return this;
  }
}
