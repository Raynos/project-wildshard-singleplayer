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

export interface PalmSpec { x: number; z: number; h: number; lean: number; leanDir: number; rot: number; fronds: number }

const C = {
  trunk: new THREE.Color('#8a6a48'), ring: new THREE.Color('#6d5238'),
  frond: new THREE.Color('#4f9a3a'), frondLight: new THREE.Color('#72b94c'), frondDark: new THREE.Color('#3b7d2c'),
  nut: new THREE.Color('#6b5a2e'),
};

export class Palms {
  mesh!: THREE.Mesh;
  colliders: Collider[] = [];
  count = 0;
  private uniforms = { uTime: { value: 0 } };

  constructor(private sky: Sky) {}

  /** Island rule: behind the beach and on the plateau top, denser in groves, never on steep rock, clear of the hut and piers. */
  static scatterIsland(seed: number, count = 150, avoid: { x: number; z: number; r: number }[] = []): PalmSpec[] {
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
      const beachEdge = h < 3.2 ? 0.55 : 0;                                        // the beach top is always lined with palms
      if (rng.next() > Math.max(beachEdge, (g + 0.35) * 0.9)) continue;           // groves inland
      if (Math.abs(x) < ROAD_WIDTH / 2 + 6 && Math.abs(z) > 140) continue;
      if (Math.abs(z) < ROAD_WIDTH / 2 + 6 && Math.abs(x) > 140) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
      out.push({ x, z, h: rng.range(5, 9.5), lean: rng.range(0.05, 0.35), leanDir: rng.range(0, Math.PI * 2), rot: rng.range(0, Math.PI * 2), fronds: rng.int(9, 13) });
    }
    return out;
  }

  build(specs: PalmSpec[]) {
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
      const segs = 7, sides = 6;
      const axis = (t: number) => tmp.set(p.x + Math.cos(p.leanDir) * p.lean * p.h * t * t, base + p.h * t, p.z + Math.sin(p.leanDir) * p.lean * p.h * t * t).clone();
      const rings: THREE.Vector3[][] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, r = 0.3 * (1 - t * 0.45) * (s % 2 ? 1.0 : 1.12), centre = axis(t);
        const ring: THREE.Vector3[] = [];
        for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2 + p.rot; ring.push(new THREE.Vector3(centre.x + Math.cos(a) * r, centre.y, centre.z + Math.sin(a) * r)); }
        rings.push(ring);
      }
      for (let s = 0; s < segs; s++) for (let k = 0; k < sides; k++) {
        const a = rings[s][k], b = rings[s][(k + 1) % sides], cc = rings[s + 1][(k + 1) % sides], d = rings[s + 1][k];
        c.copy(s % 2 ? C.ring : C.trunk).multiplyScalar(0.9 + rng.next() * 0.2);
        const w0 = (s / segs) ** 2 * 0.25, w1 = ((s + 1) / segs) ** 2 * 0.25;
        // sway weight rises with height (the top of the trunk moves a little, the fronds a lot)
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z, a.x, a.y, a.z, cc.x, cc.y, cc.z, d.x, d.y, d.z);
        for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
        sway.push(w0, phase, w0, phase, w1, phase, w0, phase, w1, phase, w1, phase);
      }
      const top = axis(1);
      // ── crown: fronds radiating out and drooping, zig-zag leaflet edges ──
      const n = p.fronds;
      for (let f = 0; f < n; f++) {
        const ang = (f / n) * Math.PI * 2 + p.rot + rng.range(-0.15, 0.15);
        const tilt = rng.range(-0.1, 0.35);            // some fronds droop lower
        const L = rng.range(3.2, 4.3), fs = 6;
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
      for (let k = 0; k < 3; k++) {
        const a = rng.range(0, Math.PI * 2), g = new THREE.IcosahedronGeometry(0.16, 0);
        g.translate(top.x + Math.cos(a) * 0.32, top.y - 0.25, top.z + Math.sin(a) * 0.32);
        const pp = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pp.count; i++) { pos.push(pp.getX(i), pp.getY(i), pp.getZ(i)); col.push(C.nut.r, C.nut.g, C.nut.b); sway.push(0.3, phase); }
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
    if (!parts.length) console.warn('[palms] nothing placed — %d candidates rejected', specs.length);
    const geo = parts.length ? mergeGeometries(parts, false)! : new THREE.BufferGeometry();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 sway; uniform float uTime;')
        .replace('#include <begin_vertex>', `
          vec3 transformed = vec3( position );
          {
            float w = sway.x, ph = sway.y;
            float g = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25;
            transformed.x += g * w * 0.22;
            transformed.z += cos(uTime * 1.1 + ph) * w * 0.14;
            transformed.y -= abs(g) * w * 0.05;
          }`);
    };
    mat.customProgramCacheKey = () => 'palms-sway';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    return this;
  }

  update(dt: number) { this.uniforms.uTime.value += dt; }
}
