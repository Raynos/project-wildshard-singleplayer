/**
 * RopeBridge — a walkable, swaying rope-and-plank bridge (Driftwood Isle: over the gully on the
 * headland climb). Anchor posts at both ends, planks on a sagging catenary, rope handrails with
 * vertical stays, rail colliders in three segments that follow the sag. The sway is a vertex-
 * shader offset weighted by the span position (nothing moves on the CPU); `floorHeightAt` is the
 * still catenary, which the ≤ 8 cm sway never contradicts by more than a step.
 *
 *   const bridge = new RopeBridge(sky, { a: [52, 48], b: [64, 60], sag: 1.1 }).build();
 *   scene.add(bridge.mesh); player.colliders.push(...bridge.colliders);
 *   player.platforms.push((x, z) => bridge.floorHeightAt(x, z));
 *   game.onUpdate((dt) => bridge.update(dt));
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';

export interface RopeBridgeSpec { a: [number, number]; b: [number, number]; /** metres the middle hangs below the straight line */ sag?: number; width?: number }

const C = { post: new THREE.Color('#6f5638'), plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), rope: new THREE.Color('#d2bd85') };

export class RopeBridge {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  private uniforms = { uTime: { value: 0 } };
  private ya = 0; private yb = 0; private len = 0; private dir = new THREE.Vector2(); private width = 1.4; private sag = 1;

  constructor(private sky: Sky, private spec: RopeBridgeSpec) {}

  /** plank height at span fraction t (0 at a → 1 at b) */
  private deckY(t: number) { return this.ya + (this.yb - this.ya) * t - this.sag * 4 * t * (1 - t); }

  build() {
    const rng = new Rng(SEED ^ 0xb21d);
    const { a, b } = this.spec;
    this.width = this.spec.width ?? 1.4; this.sag = this.spec.sag ?? 1.0;
    this.ya = heightAt(a[0], a[1]) + 0.35; this.yb = heightAt(b[0], b[1]) + 0.35;
    this.len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.dir.set((b[0] - a[0]) / this.len, (b[1] - a[1]) / this.len);
    const side = new THREE.Vector2(-this.dir.y, this.dir.x);
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, col: THREE.Color, w: number, jitter = 0.06) => {
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.index ? g.toNonIndexed() : g;
      const n = ni.attributes.position.count, c = new Float32Array(n * 3), sway = new Float32Array(n);
      for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; sway[i + j] = w; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      ni.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
      parts.push(ni);
    };
    const at = (t: number, s: number, dy: number) => new THREE.Vector3(a[0] + this.dir.x * this.len * t + side.x * s, this.deckY(t) + dy, a[1] + this.dir.y * this.len * t + side.y * s);
    const beam = (p: THREE.Vector3, q: THREE.Vector3, r: number, col: THREE.Color, w: number) => {
      const l = p.distanceTo(q), g = new THREE.CylinderGeometry(r, r, l, 4, 1, true);
      g.translate(0, l / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize()));
      g.translate(p.x, p.y, p.z);
      add(g, col, w, 0.04);
    };
    const swayAt = (t: number) => Math.sin(t * Math.PI);
    const hw = this.width / 2;
    // ── anchor posts (two per end), sunk into the ground ──
    for (const [t, y] of [[0, this.ya], [1, this.yb]] as [number, number][]) for (const s of [-1, 1]) {
      const p = at(t, s * (hw + 0.15), 0);
      const gy = heightAt(p.x, p.z);
      add(new THREE.CylinderGeometry(0.13, 0.16, y + 1.3 - gy + 0.5, 6).translate(p.x, (y + 1.3 + gy - 0.5) / 2, p.z), C.post, 0);
      this.colliders.push({ x: p.x, z: p.z, hw: 0.18, hd: 0.18, rot: 0, yTop: y + 1.3, yBottom: gy - 1 });
    }
    // ── planks every 0.42 m along the catenary ──
    const n = Math.max(4, Math.round(this.len / 0.42));
    const yaw = Math.atan2(this.dir.x, this.dir.y);
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = at(t, 0, 0);
      const slope = Math.atan2(this.deckY(Math.min(1, t + 0.01)) - this.deckY(Math.max(0, t - 0.01)), 0.02 * this.len);
      const g = new THREE.BoxGeometry(this.width + 0.2 + rng.range(-0.04, 0.04), 0.06, 0.3);
      g.rotateX(-slope); g.rotateY(yaw); g.translate(p.x, p.y, p.z);
      add(g, i % 3 === 0 ? C.plankDark : C.plank, swayAt(t), 0.06);
    }
    // ── the two load ropes under the plank ends, handrails 1 m up, stays every ~1.7 m ──
    const segs = Math.max(6, Math.round(this.len / 1.2));
    for (const s of [-1, 1]) {
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        beam(at(t0, s * (hw + 0.05), -0.04), at(t1, s * (hw + 0.05), -0.04), 0.035, C.rope, swayAt((t0 + t1) / 2));
        beam(at(t0, s * (hw + 0.12), 1.0), at(t1, s * (hw + 0.12), 1.0), 0.035, C.rope, swayAt((t0 + t1) / 2));
      }
      const stays = Math.max(3, Math.round(this.len / 1.7));
      for (let i = 1; i < stays; i++) { const t = i / stays; beam(at(t, s * (hw + 0.1), -0.02), at(t, s * (hw + 0.12), 1.0), 0.025, C.rope, swayAt(t)); }
      // rail colliders in three sagging segments
      for (let i = 0; i < 3; i++) {
        const t0 = i / 3, t1 = (i + 1) / 3, mid = at((t0 + t1) / 2, s * (hw + 0.12), 0);
        this.colliders.push({ x: mid.x, z: mid.z, hw: 0.06, hd: this.len / 6, rot: -yaw, yTop: Math.max(this.deckY(t0), this.deckY(t1)) + 1.1, yBottom: Math.min(this.deckY(t0), this.deckY(t1)) - 0.5 });
      }
    }

    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    const sx = side.x, sz = side.y;
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, { uSide: { value: new THREE.Vector3(sx, 0, sz) } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float sway; uniform float uTime; uniform vec3 uSide;')
        .replace('#include <begin_vertex>', `
          vec3 transformed = vec3( position );
          {
            float g = sin(uTime * 0.9) * 0.7 + sin(uTime * 2.3 + 1.0) * 0.3;
            transformed += uSide * (g * sway * 0.08);
            transformed.y -= abs(g) * sway * 0.03;
          }`);
    };
    mat.customProgramCacheKey = () => 'rope-bridge-sway';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    return this;
  }

  /** the plank height under (x, z) when over the span, else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const { a } = this.spec;
    const dx = x - a[0], dz = z - a[1];
    const along = dx * this.dir.x + dz * this.dir.y, across = -dx * this.dir.y + dz * this.dir.x;
    if (along < -0.3 || along > this.len + 0.3 || Math.abs(across) > this.width / 2 + 0.15) return undefined;
    return this.deckY(Math.min(1, Math.max(0, along / this.len))) + 0.03;
  }

  update(dt: number) { this.uniforms.uTime.value += dt; }
}
