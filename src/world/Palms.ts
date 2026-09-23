/**
 * Palms — low-poly coconut palms for Driftwood Isle, all in one flat-shaded vertex-coloured mesh.
 * A bent segmented trunk with ring bands, a crown of 8–10 drooping zig-zag fronds and a few
 * coconuts; the fronds sway in the vertex shader (per-vertex phase + height weight, no CPU work).
 *
 *   const palms = new Palms(sky).build(Palms.scatterIsland(seed));
 *   scene.add(palms.mesh); player.colliders.push(...palms.colliders);
 *   game.onUpdate((dt) => palms.update(dt));
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { heightAt, normalAt, waterLevel, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { Rng } from '../core/rng';
import { Noise2D } from '../core/noise';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { windUniforms, updateWind } from './wind';

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }

const C = {
  trunk: new THREE.Color('#8a6a48'), ring: new THREE.Color('#6d5238'),
  frond: new THREE.Color('#4f9a3a'), frondLight: new THREE.Color('#72b94c'), frondDark: new THREE.Color('#3b7d2c'),
  nut: new THREE.Color('#6b5a2e'), nutGreen: new THREE.Color('#7f9a3a'),
};

export class Palms {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  count = 0;

  constructor(private sky: Sky) {}

  /** Island rule: behind the beach and on the plateau top, denser in groves, never on steep rock, clear of the hut and piers. */
  static scatterIsland(seed: number, count = Math.round(TIER_CONFIG.palmCount * 1.7), avoid: { x: number; z: number; r: number }[] = []): PalmSpec[] {
    const rng = new Rng(seed ^ 0x9a1e), grove = new Noise2D(seed + 21);
    const wl = waterLevel();
    const out: PalmSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 80) {
      const x = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25), z = rng.range(-CHUNK_HALF + 25, CHUNK_HALF - 25);
      if (!inChunk(x, z, 20)) continue;
      const h = heightAt(x, z) - wl;
      if (h < 1.4) continue;                                                       // land only, above the beach berm
      const [, ny] = normalAt(x, z, 1.5);
      if (ny < 0.9) continue;                                                      // not on the crag walls
      const g = grove.fbm(x * 0.012, z * 0.012, 3);
      const beachEdge = h < 3.4 ? 0.95 : 0;                                        // the back beach is lined with palms (E43: twice as many)
      if (rng.next() > Math.max(beachEdge, (g + 0.35) * 0.9)) continue;           // groves inland
      if (Math.abs(x) < ROAD_WIDTH / 2 + 6 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 6 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3.8)) continue;
      out.push({ x, z, h: rng.range(5, 9.5), lean: rng.range(0.05, 0.35), leanDir: rng.range(0, Math.PI * 2), rot: rng.range(0, Math.PI * 2), fronds: rng.int(9, 13) });
    }
    return out;
  }

  build(specs: PalmSpec[]): this {
    const rng = new Rng(0x5ea1 ^ 0x9a);
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Color();
    const tmp = new THREE.Vector3();
    for (const p of specs) {
      const base = heightAt(p.x, p.z) - 0.2;
      const pos: number[] = [], col: number[] = [], sway: number[] = [];
      const phase = rng.range(0, Math.PI * 2);
      const face = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, wa: number, wb: number, wd: number) => {
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
        for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
        sway.push(wa, phase, wb, phase, wd, phase);
      };
      // ── trunk: a curve leaning by `lean` in `leanDir`, 7 segments, 6 sides, thinner at the top ──
      const segs = 11, sides = 6;
      // a curved trunk: the lean grows with height and a slight S-bend (the base kicks back before it arches out)
      const axis = (t: number) => {
        const off = p.lean * p.h * (t * t - 0.12 * Math.sin(t * Math.PI));
        return tmp.set(p.x + Math.cos(p.leanDir) * off, base + p.h * t, p.z + Math.sin(p.leanDir) * off).clone();
      };
      const rings: THREE.Vector3[][] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, r = 0.3 * (1 - t * 0.45) * (s % 2 ? 0.94 : 1.16) * (s === 0 ? 1.25 : 1), centre = axis(t);
        const ring: THREE.Vector3[] = [];
        for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2 + p.rot; ring.push(new THREE.Vector3(centre.x + Math.cos(a) * r, centre.y, centre.z + Math.sin(a) * r)); }
        rings.push(ring);
      }
      for (let s = 0; s < segs; s++) for (let k = 0; k < sides; k++) {
        const r0 = rings[s], r1 = rings[s + 1];
        if (!r0 || !r1) continue;
        const a = r0[k], b = r0[(k + 1) % sides], cc = r1[(k + 1) % sides], d = r1[k];
        if (!a || !b || !cc || !d) continue;
        c.copy(s % 2 ? C.ring : C.trunk).multiplyScalar(0.9 + rng.next() * 0.2);
        const w0 = (s / segs) ** 2 * 0.25, w1 = ((s + 1) / segs) ** 2 * 0.25;
        // sway weight rises with height (the top of the trunk moves a little, the fronds a lot)
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z, a.x, a.y, a.z, cc.x, cc.y, cc.z, d.x, d.y, d.z);
        for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
        sway.push(w0, phase, w0, phase, w1, phase, w0, phase, w1, phase, w1, phase);
      }
      const top = axis(1);
      // ── crown: fronds radiating out and drooping, zig-zag leaflet edges ──
      // two layers (E43: twice the fronds): the long drooping skirt, then a shorter crown of younger fronds on top
      const n = p.fronds, n2 = Math.round(n * 0.9);
      for (let f = 0; f < n + n2; f++) {
        const upper = f >= n, fi = upper ? f - n + 0.5 : f, nn = upper ? n2 : n;
        const ang = (fi / nn) * Math.PI * 2 + p.rot + rng.range(-0.15, 0.15);
        const tilt = upper ? rng.range(-0.45, -0.2) : rng.range(-0.1, 0.35);   // the young fronds stand up, some old ones droop low
        const L = upper ? rng.range(2.2, 3.0) : rng.range(3.2, 4.3), fs = TIER_CONFIG.palmFrondSegs; // 6 desktop / 4 phone segments per frond
        const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        const side = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
        const shade = rng.next();
        const fc = shade < 0.3 ? C.frondDark : shade > 0.75 ? C.frondLight : C.frond;
        const spine = (t: number) => { const y = 0.9 * Math.sin(t * Math.PI * 0.55) - (1.4 + tilt * 2.2) * t * t + 0.15; return new THREE.Vector3(top.x + dir.x * L * t, top.y + y, top.z + dir.z * L * t); };
        let prevL = spine(0), prevR = spine(0);
        for (let s = 1; s <= fs; s++) {
          const t = s / fs, tp = (s - 1) / fs;
          const w = 0.7 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + (s % 2 ? 0.2 : -0.07);  // zig-zag edge
          const sp = spine(t);
          const l = sp.clone().addScaledVector(side, w), r = sp.clone().addScaledVector(side, -w);
          c.copy(fc).multiplyScalar(0.85 + t * 0.3);
          const wA = 0.35 + tp * 0.9, wB = 0.35 + t * 0.9;
          if (s === 1) face(prevL, l, r, c, wA, wB, wB);
          else { face(prevL, l, r, c, wA, wB, wB); face(prevL, r, prevR, c, wA, wB, wA); }
          prevL = l; prevR = r;
        }
      }
      // ── coconuts ──
      // a coconut cluster under the crown (5–7, brown and green)
      const nuts = rng.int(5, 7);
      for (let k = 0; k < nuts; k++) {
        const a = (k / nuts) * Math.PI * 2 + rng.range(-0.3, 0.3), rr = rng.range(0.17, 0.22), g = new THREE.IcosahedronGeometry(rr, 0);
        g.translate(top.x + Math.cos(a) * 0.36, top.y - 0.22 - (k % 2) * 0.2, top.z + Math.sin(a) * 0.36);
        const pp = g.getAttribute('position'), nc = k % 3 === 0 ? C.nutGreen : C.nut;
        for (let i = 0; i < pp.count; i += 3) {
          const j = 0.85 + rng.next() * 0.3;
          for (let v = 0; v < 3; v++) { pos.push(pp.getX(i + v), pp.getY(i + v), pp.getZ(i + v)); col.push(nc.r * j, nc.g * j, nc.b * j); sway.push(0.3, phase); }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 2));
      parts.push(geo);
      this.colliders.push({ x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0, yTop: base + p.h, yBottom: base - 1 });
      this.count++;
    }
    // an empty scatter (a stale terrain, a def with no land) must not throw in mergeGeometries: an empty mesh instead
    if (parts.length === 0) console.warn('[palms] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => { attachFogUniforms(shader); patchPalmSway(shader); };
    mat.customProgramCacheKey = () => 'palms-sway';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    // the shadow pass sways the fronds too, so the palm shadows on the sand move (M5)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    depth.onBeforeCompile = (shader) => patchPalmSway(shader);
    depth.customProgramCacheKey = () => 'palms-sway-depth';
    this.mesh.customDepthMaterial = depth;
    return this;
  }

  /** the island's wind gust, 0 calm … 1 gusting (wind.ts) — what the fronds, bushes, grass, sails and banner sway with; the
   * sound agent's palm rustle reads it */
  get gust(): number { return windUniforms.uGust.value; }

  /** advances the shared wind (wind.ts) — once a frame, for everything that sways */
  update(dt: number): void { updateWind(dt); }
}

/** the fronds' sway (per-vertex weight + phase in `sway`), stronger in a gust — for the lit and the shadow-pass material */
function patchPalmSway(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }): void {
  shader.uniforms['uTime'] = windUniforms.uWindTime;
  shader.uniforms['uGust'] = windUniforms.uGust;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 sway; uniform float uTime; uniform float uGust;')
    .replace('#include <begin_vertex>', `
      vec3 transformed = vec3( position );
      {
        float w = sway.x * (0.55 + 0.8 * uGust), ph = sway.y;
        float g = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25 + 0.35 * uGust;
        transformed.x += g * w * 0.22;
        transformed.z += cos(uTime * 1.1 + ph) * w * 0.14;
        transformed.y -= abs(g) * w * 0.05;
      }`);
}
