/**
 * Bushes — low-poly shrubs for Driftwood Isle: clumps of two to four squashed icosahedra in
 * island greens, a quarter of them dotted with red hibiscus. One flat-shaded vertex-coloured
 * mesh, no colliders (you walk through them). `?bush=a|b|c` swaps in one of the E116 candidate looks (bushKit.ts: leaf
 * clump / sculpted canopy / leaf cards) — the user's pick; without it, the current look.
 *
 *   const bushes = new Bushes(sky).build(Bushes.scatterIsland(seed));
 *   scene.add(bushes.mesh);
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, waterLevel, inChunk } from './Heightfield';
import { Rng } from '../core/rng';
import { Noise2D } from '../core/noise';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { attachFogUniforms } from './Atmosphere';
import { patchSway, swayByHeight, swayDepthMaterial } from './wind';
import { bushLook, bushParts, bushMaterial, bushDepthMaterial } from './bushKit';

export interface BushSpec { x: number; z: number; r: number; flowers: boolean }

const GREENS = [new THREE.Color('#4f9a3a'), new THREE.Color('#5fae44'), new THREE.Color('#3f8a32'), new THREE.Color('#78bd4e')];
const FLOWER = new THREE.Color('#d8302f'), FLOWER2 = new THREE.Color('#e8603a');

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
    const look = bushLook();
    if (look !== 'current') {
      const rng = new Rng(0x5ea1 ^ 0xb5 ^ 0xe116);
      const parts: THREE.BufferGeometry[] = [];
      for (const b of specs) { parts.push(...bushParts(look, b, heightAt(b.x, b.z), rng)); this.count++; }
      if (parts.length === 0) console.warn('[bushes] nothing placed — %d candidates rejected', specs.length);
      const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
      for (const p of parts) p.dispose();
      geo.computeBoundingSphere();
      this.mesh = new THREE.Mesh(geo, bushMaterial(this.sky, look));
      this.mesh.castShadow = TIER_CONFIG.bushShadows; this.mesh.receiveShadow = true;
      this.mesh.customDepthMaterial = bushDepthMaterial(look);
      return this;
    }
    const rng = new Rng(0x5ea1 ^ 0xb5);
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Color();
    for (const b of specs) {
      const y = heightAt(b.x, b.z);
      const lobes = rng.int(2, 5);
      const tint = GREENS[rng.int(0, GREENS.length - 1)];
      if (tint === undefined) continue;
      for (let k = 0; k < lobes; k++) {
        const r = b.r * rng.range(0.55, 1.0);
        const ico = new THREE.IcosahedronGeometry(r, TIER_CONFIG.bushDetail); // 80 tris a lobe on desktop, 20 on the phone
        ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
        // three's icosahedron is non-indexed (every face owns its corners): weld them before the jitter, or each copy
        // moves on its own and the lobe splits into see-through cracks (E116)
        const g = mergeVertices(ico);
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count; i++) { const s = 1 + (rng.next() - 0.5) * 0.25; pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.7, pos.getZ(i) * s); }
        const a = rng.range(0, Math.PI * 2), d = k === 0 ? 0 : rng.range(0.3, b.r * 0.8);
        g.translate(b.x + Math.cos(a) * d, y + r * 0.45, b.z + Math.sin(a) * d);
        const ni = g.index ? g.toNonIndexed() : g;
        const n = ni.getAttribute('position').count, col = new Float32Array(n * 3);
        const p = ni.getAttribute('position');
        for (let i = 0; i < n; i += 3) {
          const ay = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 - y;
          c.copy(tint).multiplyScalar(0.72 + (ay / (r * 1.2)) * 0.45 + rng.next() * 0.12); // lighter on top
          for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b; }
        }
        ni.setAttribute('color', new THREE.BufferAttribute(col, 3));
        swayByHeight(ni, 0.28, y, y + b.r * 1.2, (b.x + b.z) * 0.37);   // the crown sways a little in the wind (M5)
        parts.push(ni);
      }
      if (b.flowers) for (let f = 0; f < rng.int(3, 7); f++) {
        const g = new THREE.IcosahedronGeometry(0.11, 0);
        const a = rng.range(0, Math.PI * 2), e = rng.range(0.3, 1.0);
        g.translate(b.x + Math.cos(a) * b.r * 0.8 * e, y + b.r * 0.5 + rng.range(0.1, b.r * 0.5), b.z + Math.sin(a) * b.r * 0.8 * e);
        g.deleteAttribute('uv'); g.deleteAttribute('normal');
        const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
        c.copy(rng.next() < 0.5 ? FLOWER : FLOWER2);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        swayByHeight(g, 0.28, y, y + b.r * 1.2, (b.x + b.z) * 0.37);
        parts.push(g);
      }
      this.count++;
    }
    // an empty scatter (a stale terrain, a def with no land) must not throw in mergeGeometries: an empty mesh instead
    if (parts.length === 0) console.warn('[bushes] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
    mat.onBeforeCompile = (sh) => { attachFogUniforms(sh); patchSway(sh); };
    mat.customProgramCacheKey = () => 'bushes-sway';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = TIER_CONFIG.bushShadows; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = swayDepthMaterial();
    return this;
  }
}
