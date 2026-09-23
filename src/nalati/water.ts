/**
 * Nalati's water: the braided Kunes (a strip over its gravel corridor), the plateau brook (a ribbon down its bed) and
 * the waterfall at the rim notch (a sheet down the head wall + a foam pool). One shared shader, painterly: the colour
 * comes from the water's depth over the terrain (turquoise over the gravel bars → deep blue in the channels), a pale
 * sky sheen at grazing angles, and white flow streaks that run downstream — westward (+x) on the river, down the
 * ribbon on the brook and the fall. Fogged like everything else. Three draw calls, one program.
 *
 *   const water = new NalatiWater(sky).build();  scene.add(water.group);  water.update(dt);
 */
import * as THREE from 'three';
import { heightAt } from '../world/Heightfield';
import { attachFogUniforms } from '../world/Atmosphere';
import type { Sky } from '../world/Sky';
import { RIVER, BROOK, WATERFALL } from '../chunks/nalati-grasslands';
import { CHUNK_HALF } from '../core/config';

const VERT = /* glsl */`
attribute float depth;
attribute float flow;       // 0..1 along the stream (the streaks scroll along it)
attribute float across;     // -1..1 across the stream
attribute float fall;       // 1 on the waterfall sheet
varying float vDepth; varying float vFlow; varying float vAcross; varying float vFall;
varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
void main() {
  vDepth = depth; vFlow = flow; vAcross = across; vFall = fall;
  vec3 transformed = position;
  vec4 w = modelMatrix * vec4(transformed, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uSunDir; uniform vec3 uSunCol;
varying float vDepth; varying float vFlow; varying float vAcross; varying float vFall;
varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float d = max(vDepth, 0.0);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.1, 1.4, d));
  // painted sky sheen at grazing angles, a warm glint toward the sun
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  col = mix(col, uSky, fres * 0.35);
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  col += uSunCol * pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.8;
  // flow streaks: long noise dashes scrolling downstream, denser over the shallows (riffles) and on the fall
  float speed = mix(0.35, 2.4, vFall);
  vec2 q = vec2(vFlow * mix(260.0, 40.0, vFall) - uTime * speed * mix(1.0, 6.0, vFall), vAcross * mix(9.0, 5.0, vFall));
  float streak = smoothstep(0.62, 0.9, vnoise(q * vec2(0.18, 1.0)) * 0.7 + vnoise(q * vec2(0.5, 2.3) + 7.0) * 0.3);
  // riffles: white water where the channel shoals onto the bars, broken by the streaks
  float riffle = 1.0 - smoothstep(0.08, 0.45, d);
  float edgeFoam = riffle * smoothstep(0.35, 0.75, vnoise(vec2(vFlow * 420.0 - uTime * 0.9, vAcross * 22.0)) + 0.25);
  float foam = clamp(streak * (0.35 + 0.65 * riffle) + edgeFoam * 0.85 + vFall * (0.35 + streak * 0.6), 0.0, 1.0);
  col = mix(col, uFoam, foam * 0.8);
  // the fall: vertical white ropes over a green-turquoise sheet, racing down
  float rope = smoothstep(0.35, 0.85, vnoise(vec2(vAcross * 11.0, vFlow * 55.0 - uTime * 3.2)) * 0.75 + vnoise(vec2(vAcross * 29.0 + 3.0, vFlow * 120.0 - uTime * 4.1)) * 0.35);
  col = mix(col, mix(uShallow * 1.5, uFoam, 0.5 + 0.5 * rope), step(0.9, vFall));
  // the edge: fade out where the water thins over the bank
  float alpha = mix(smoothstep(0.0, 0.12, vDepth) * 0.92, 0.72 + 0.25 * rope, step(0.9, vFall));
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}`;

export class NalatiWater {
  group = new THREE.Group();
  private uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(0.06, 0.6, 0.66) },
    uDeep: { value: new THREE.Color(0.0, 0.24, 0.46) },
    uSky: { value: new THREE.Color(0.5, 0.75, 1.0) },
    uFoam: { value: new THREE.Color(0.95, 0.98, 1.0) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 0.9, 0.7) },
  };

  constructor(private sky: Sky) {}

  build(): this {
    this.uniforms.uSunDir.value.copy(this.sky.sunDir);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, // the fall's sheet is seen from both sides (one material, one program for all three)
    });
    Object.assign(mat.uniforms, this.uniforms);
    attachFogUniforms(mat);
    mat.customProgramCacheKey = () => 'nalati-water';
    this.group.add(this.river(mat), this.brook(mat), this.waterfall(mat));
    this.group.traverse((o) => { o.renderOrder = 1; });
    return this;
  }

  update(dt: number): void { this.uniforms.uTime.value += dt; }

  /** the Kunes: a strip following the corridor's centreline, full width, with per-vertex depth over the bed */
  private river(mat: THREE.Material): THREE.Mesh {
    const nx = 256, nz = 32, x0 = -CHUNK_HALF - 2, x1 = CHUNK_HALF + 2;
    const pos: number[] = [], depth: number[] = [], flow: number[] = [], across: number[] = [], fall: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, zc = RIVER.z(x), half = RIVER.half(x) + 4;
      for (let j = 0; j <= nz; j++) {
        const u = (j / nz) * 2 - 1, z = zc + u * half;
        pos.push(x, RIVER.level, z);
        depth.push(RIVER.level - heightAt(x, z)); flow.push((x - x0) / (x1 - x0)); across.push(u); fall.push(0);
      }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j, b = a + nz + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return mesh(mat, pos, idx, { depth, flow, across, fall });
  }

  /** the plateau brook: a 3 m ribbon along its polyline, 0.25 m under the bed's lip */
  private brook(mat: THREE.Material): THREE.Mesh {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < BROOK.length - 1; i++) {
      const a = BROOK[i], b = BROOK[i + 1];
      if (!a || !b) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
      for (let k = 0; k < n; k++) pts.push(new THREE.Vector2(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n));
    }
    const last = BROOK[BROOK.length - 1];
    if (last) pts.push(new THREE.Vector2(last[0], last[1] - 2)); // to the lip of the fall
    const pos: number[] = [], depth: number[] = [], flow: number[] = [], across: number[] = [], fall: number[] = [], idx: number[] = [];
    const half = 1.9;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      if (!p || !q || !o) continue;
      const tx = q.x - o.x, tz = q.y - o.y, tl = Math.hypot(tx, tz) || 1;
      const sx = -tz / tl, sz = tx / tl;
      // draped: each vertex just over the ground under it (the 2 m terrain grid only half-resolves the bed, so a flat
      // surface at the bed's level would float over the rendered banks and read as a line across the hill)
      const yBed = heightAt(p.x, p.y);
      for (const u of [-1, 0, 1]) {
        const x = p.x + sx * half * u, z = p.y + sz * half * u;
        const y = Math.min(yBed + 0.6, heightAt(x, z) + 0.3);
        pos.push(x, y, z); depth.push(u === 0 ? 0.5 : 0.08); flow.push(i / pts.length * 0.35); across.push(u); fall.push(0);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 2; j++) {
      const a = i * 3 + j, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return mesh(mat, pos, idx, { depth, flow, across, fall });
  }

  /** the waterfall: a sheet from the notch lip down the head wall to the ravine floor, bowed slightly outward, + its pool */
  private waterfall(mat: THREE.Material): THREE.Mesh {
    const pos: number[] = [], depth: number[] = [], flow: number[] = [], across: number[] = [], fall: number[] = [], idx: number[] = [];
    const lipZ = WATERFALL.z + 1, rows = 16, cols = 6, half = 2.6;
    const top = heightAt(WATERFALL.x, lipZ - 3) + 0.4;
    // walk downstream (+z, toward the valley) until the ground has dropped: that is the foot of the fall
    let footZ = lipZ, footY = top;
    for (let z = lipZ; z < lipZ + 40; z += 0.5) { const y = heightAt(WATERFALL.x, z); if (y < footY) { footY = y; footZ = z; } if (top - y > 4 && heightAt(WATERFALL.x, z + 2) > y - 0.3) break; }
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const y = top + (footY + 0.3 - top) * t;
      const z = lipZ + (footZ - lipZ) * Math.sqrt(t) + Math.sin(t * Math.PI) * 1.2; // the sheet leaps out, then drops
      for (let c = 0; c <= cols; c++) {
        const u = (c / cols) * 2 - 1;
        pos.push(WATERFALL.x + u * half * (1 + t * 0.4), y, z); depth.push(1); flow.push(t * 0.4); across.push(u); fall.push(1);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    // the plunge pool: a foamy disc at the foot
    const base = pos.length / 3, seg = 18, pr = 5.5;
    pos.push(WATERFALL.x, footY + 0.35, footZ + 2); depth.push(1.2); flow.push(0); across.push(0); fall.push(0.6);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, x = WATERFALL.x + Math.cos(a) * pr, z = footZ + 2 + Math.sin(a) * pr;
      pos.push(x, footY + 0.35, z); depth.push(0); flow.push(k / seg); across.push(1); fall.push(0.3);
    }
    for (let k = 0; k < seg; k++) idx.push(base, base + 2 + k, base + 1 + k);
    return mesh(mat, pos, idx, { depth, flow, across, fall });
  }
}

function mesh(mat: THREE.Material, pos: number[], idx: number[], attrs: Record<string, number[]>): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const [k, v] of Object.entries(attrs)) geo.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}
