/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * Five InstancedMeshes (one per plant, five draws, no shadow casting), refilled from 16 m cells round the player
 * whenever you have moved 4 m: each cell's candidates are generated once (deterministic, from the cell's hash) and
 * cached, then the ones inside DRAW_R are copied into the instance buffers — no per-frame allocation. The vertex shader
 * grows each instance out of the ground between FADE_R0 and FADE_R1 (no pop, no overdraw), bends the blades away from
 * the player's legs and sways them in the wind (`GroundCover.wind`, 0..1 — the shared gust M5 drives).
 *
 *   const cover = new GroundCover(sky, { sea: sea.level }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * Placement follows the terrain's own paint (Terrain.ts lowPolyGroundColor): grass above ~3 m over the sea on slopes
 * under 0.24, sand below; never on the sand paths, on steep rock, in the water, or inside a POI's footprint.
 */
import * as THREE from 'three';
import { heightAt, normalAt, trailDistance } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { LowPolyKit, fern, hibiscus, grassTuft, rock, PLANT, type Part } from './lowpolyKit';
import { HUT, LOOKOUT, SHRINE, WRECK } from '../chunks/driftwood-isle';
import { Cove } from './Cove';
import type { Sky } from './Sky';

export interface GroundCoverOpts { sea: number }

const CELL = 16, DRAW_R = 27, FADE_R0 = 19, FADE_R1 = 25.5, REFILL_M = 4;
/** the shared wind the blades sway in (0 calm … 1 gusting); M5's palms.gust drives it */
export const coverWind = { value: 0.55 };

interface Kind {
  name: string;
  mesh: THREE.InstancedMesh;
  cap: number;
  /** instances per m² at (h over the sea, slope, trail distance, shrine distance) */
  density: (h: number, slope: number, td: number, shrineD: number) => number;
  scale: [number, number];
  /** per-instance tint (multiplies the vertex colours) */
  tint?: (h: number, rng: Rng, out: THREE.Color) => void;
}

const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export class GroundCover {
  group = new THREE.Group();
  private kinds: Kind[] = [];
  private cells = new Map<string, Float32Array[]>();
  private last = new THREE.Vector3(1e9, 0, 1e9);
  private uniforms = { uPlayer: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: coverWind, uR: { value: new THREE.Vector2(FADE_R0, FADE_R1) } };
  private avoid: { x: number; z: number; r: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private tint = new THREE.Color();

  constructor(private sky: Sky, private opts: GroundCoverOpts) {
    const cave = Cove.forIsland().cave;
    this.avoid = [
      { x: HUT.x, z: HUT.z, r: 9 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 8 }, { x: SHRINE.x, z: SHRINE.z, r: 9.5 },
      { x: WRECK.x, z: WRECK.z, r: 13 }, { x: cave.x, z: cave.z + cave.depth / 2, r: 8 },
    ];
  }

  build(): this {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    this.patch(mat);
    this.sky.setupMaterial(mat);
    const geo = (parts: Part[] | ((k: LowPolyKit) => void), seed: number): THREE.BufferGeometry => {
      const kit = new LowPolyKit(SEED ^ seed);
      if (typeof parts === 'function') parts(kit); else kit.addParts(parts, { jitter: 0.08 });
      return kit.finish({ ao: false });
    };
    const rng = new Rng(SEED ^ 0x6c0e);
    // a tuft: two bunches of blades so one instance reads as a clump
    const tuftGeo = geo((k) => { k.addParts(grassTuft(rng, 0.42), { jitter: 0.08 }); k.addParts(grassTuft(rng, 0.32), { matrix: new THREE.Matrix4().makeTranslation(0.12, 0, 0.08), jitter: 0.08 }); }, 0x6c01);
    const fernGeo = geo(fern(rng, 0.75), 0x6c02);
    const hibGeo = geo((k) => {
      k.addParts(fern(rng, 0.42), { jitter: 0.08 });
      for (const [x, y, z] of [[0, 0.32, 0], [0.18, 0.26, 0.1], [-0.14, 0.24, 0.12]] as const) k.addParts(hibiscus(0.09), { matrix: new THREE.Matrix4().makeRotationX(-0.5).setPosition(x, y, z), jitter: 0.05 });
    }, 0x6c03);
    const daisyGeo = geo((k) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + rng.range(0, 0.6), d = rng.range(0.05, 0.2), h = rng.range(0.14, 0.26), x = Math.cos(a) * d, z = Math.sin(a) * d;
        k.add(new THREE.CylinderGeometry(0.008, 0.01, h, 3).translate(x, h / 2, z), PLANT.stem);
        const petals: number[] = [];
        for (let p = 0; p < 6; p++) { const b = (p / 6) * Math.PI * 2; petals.push(x, h, z, x + Math.cos(b) * 0.05, h + 0.005, z + Math.sin(b) * 0.05, x + Math.cos(b + 0.5) * 0.05, h + 0.005, z + Math.sin(b + 0.5) * 0.05); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(petals, 3));
        k.add(g, i % 2 ? '#f6f2e6' : '#fbe9a0', { jitter: 0.03 });
        k.add(new THREE.OctahedronGeometry(0.018, 0).translate(x, h + 0.01, z), PLANT.stamen);
      }
      k.addParts(grassTuft(rng, 0.2), { jitter: 0.08 });
    }, 0x6c04);
    const pebbleGeo = geo((k) => {
      for (let i = 0; i < 3; i++) {
        const r = rng.range(0.1, 0.22), a = rng.range(0, 6.28), d = i === 0 ? 0 : rng.range(0.2, 0.35);
        k.addTopped(rock(r, 0, rng, 0.6, 0.25), '#7d8187', '#6d9a44', { matrix: new THREE.Matrix4().makeTranslation(Math.cos(a) * d, r * 0.2, Math.sin(a) * d), minY: 0.7, jitter: 0.08 });
      }
    }, 0x6c05);

    const beach = (h: number) => ss(0.5, 1.2, h) * (1 - ss(2.0, 3.2, h));
    const grass = (h: number, slope: number) => ss(2.6, 4.2, h) * (1 - ss(0.18, 0.26, slope));
    const off = (td: number) => ss(2.6, 4.0, td);
    const jungle = (sd: number) => 1 - ss(18, 45, sd);
    const kind = (name: string, g: THREE.BufferGeometry, cap: number, scale: [number, number], density: Kind['density'], tint?: Kind['tint']): void => {
      const mesh = new THREE.InstancedMesh(g, mat, cap);
      mesh.name = `ground-cover-${name}`;
      mesh.count = 0;
      mesh.frustumCulled = false;                           // the window moves with the player; one sphere per refill would do too
      mesh.castShadow = false; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tint) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      this.group.add(mesh);
      this.kinds.push({ name, mesh, cap, density, scale, ...(tint ? { tint } : {}) });
    };
    kind('tuft', tuftGeo, 5200, [0.9, 1.5],
      (h, sl, td) => (grass(h, sl) * 1.6 + beach(h) * 0.08) * off(td),
      (h, r, out) => { const b = beach(h); out.setRGB(1 + b * 0.35 + r.range(-0.08, 0.08), 1 + b * 0.12 + r.range(-0.06, 0.06), 1 - b * 0.35); });
    kind('fern', fernGeo, 700, [0.7, 1.4], (h, sl, td, sd) => grass(h, sl) * off(td) * (0.03 + jungle(sd) * 0.35));
    kind('hibiscus', hibGeo, 400, [0.8, 1.3], (h, sl, td, sd) => grass(h, sl) * off(td) * (0.025 + jungle(sd) * 0.08));
    kind('daisy', daisyGeo, 500, [0.8, 1.4], (h, sl, td) => grass(h, sl) * off(td) * 0.07);
    kind('pebble', pebbleGeo, 400, [0.7, 1.5], (h, sl, td) => (grass(h, sl) * 0.03 + beach(h) * 0.05) * (0.4 + 0.6 * off(td)));
    this.group.name = 'ground-cover';
    return this;
  }

  /** a cell's candidates per kind: [x, y, z, yaw, scale, r, g, b] × n — generated once, then cached */
  private cell(cx: number, cz: number): Float32Array[] {
    const key = `${cx},${cz}`;
    const hit = this.cells.get(key);
    if (hit) return hit;
    const rng = new Rng(SEED ^ Math.imul(cx + 1013, 73856093) ^ Math.imul(cz + 2027, 19349663));
    const sea = this.opts.sea;
    const vals: number[][] = this.kinds.map(() => []);
    // one candidate set per cell (≈ 2 per m²), the terrain read once per point, then a density lottery per kind
    const n = 520;
    for (let i = 0; i < n; i++) {
      const x = (cx + rng.next()) * CELL, z = (cz + rng.next()) * CELL;
      if (this.avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) continue;
      const y = heightAt(x, z), h = y - sea;
      if (h < 0.4) continue;
      const [, ny] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) continue;
      const td = trailDistance(x, z), sd = Math.hypot(x - SHRINE.x, z - SHRINE.z);
      this.kinds.forEach((k, ki) => {
        const d = k.density(h, slope, td, sd);
        if (rng.next() * 2 > d) return;
        const jx = x + rng.range(-0.3, 0.3), jz = z + rng.range(-0.3, 0.3), sc = rng.range(k.scale[0], k.scale[1]);
        if (k.tint) k.tint(h, rng, this.tint); else this.tint.setRGB(1, 1, 1);
        vals[ki]?.push(jx, heightAt(jx, jz) - 0.02, jz, rng.range(0, Math.PI * 2), sc, this.tint.r, this.tint.g, this.tint.b);
      });
    }
    const out = vals.map((v) => new Float32Array(v));
    if (this.cells.size > 96) { const first = this.cells.keys().next().value; if (first !== undefined) this.cells.delete(first); }
    this.cells.set(key, out);
    return out;
  }

  private refill(px: number, pz: number): void {
    const r2 = DRAW_R * DRAW_R, c0x = Math.floor((px - DRAW_R) / CELL), c1x = Math.floor((px + DRAW_R) / CELL), c0z = Math.floor((pz - DRAW_R) / CELL), c1z = Math.floor((pz + DRAW_R) / CELL);
    const counts = this.kinds.map(() => 0);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const data = this.cell(cx, cz);
      this.kinds.forEach((k, ki) => {
        const v = data[ki];
        if (v === undefined) return;
        let n = counts[ki] ?? 0;
        for (let i = 0; i < v.length && n < k.cap; i += 8) {
          const x = v[i] ?? 0, z = v[i + 2] ?? 0;
          if ((x - px) ** 2 + (z - pz) ** 2 > r2) continue;
          const s = v[i + 4] ?? 1;
          this.q.setFromAxisAngle(this.up, v[i + 3] ?? 0);
          this.m.compose(this.p.set(x, v[i + 1] ?? 0, z), this.q, this.s.set(s, s, s));
          k.mesh.setMatrixAt(n, this.m);
          if (k.mesh.instanceColor) k.mesh.setColorAt(n, this.tint.setRGB(v[i + 5] ?? 1, v[i + 6] ?? 1, v[i + 7] ?? 1));
          n++;
        }
        counts[ki] = n;
      });
    }
    this.kinds.forEach((k, ki) => {
      k.mesh.count = counts[ki] ?? 0;
      k.mesh.instanceMatrix.needsUpdate = true;
      if (k.mesh.instanceColor) k.mesh.instanceColor.needsUpdate = true;
    });
  }

  update(dt: number, player: THREE.Vector3): void {
    this.uniforms.uTime.value += dt;
    this.uniforms.uPlayer.value.copy(player);
    if ((player.x - this.last.x) ** 2 + (player.z - this.last.z) ** 2 > REFILL_M * REFILL_M) {
      this.last.copy(player);
      this.refill(player.x, player.z);
    }
  }

  /** grow out of the ground with distance, bend away from the player's legs, sway in the wind */
  private patch(mat: THREE.MeshStandardMaterial): void {
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      attachFogUniforms(sh);
      sh.uniforms['uPlayer'] = u.uPlayer; sh.uniforms['uTime'] = u.uTime; sh.uniforms['uWind'] = u.uWind; sh.uniforms['uR'] = u.uR;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uPlayer; uniform float uTime; uniform float uWind; uniform vec2 uR;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec3 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 away = io.xz - uPlayer.xz;
          float dl = max(length(away), 1e-3);
          transformed *= 1.0 - smoothstep(uR.x, uR.y, dl);
          float hgt = max(position.y, 0.0);
          vec2 push = (away / dl) * (1.0 - smoothstep(0.35, 1.5, dl)) * 1.1;
          float ph = io.x * 0.31 + io.z * 0.23;
          vec2 wind = vec2(sin(uTime * 1.7 + ph) + 0.5 * sin(uTime * 3.1 + ph * 1.7), 0.6 * cos(uTime * 1.3 + ph)) * (0.05 + 0.18 * uWind);
          vec2 off = (push + wind) * hgt;
          vec3 ax = instanceMatrix[0].xyz, az = instanceMatrix[2].xyz;
          float s2 = max(dot(ax, ax), 1e-4);
          transformed.x += dot(vec3(off.x, 0.0, off.y), ax) / s2;
          transformed.z += dot(vec3(off.x, 0.0, off.y), az) / s2;
          transformed.y -= length(off) * 0.4 * hgt;
        }
        #endif`);
    };
    mat.customProgramCacheKey = () => 'ground-cover';
  }
}
