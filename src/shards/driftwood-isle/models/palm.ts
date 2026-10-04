/**
 * The coconut palm (E306 / E315 M1: a model on the contract, src/engine/models/model.ts). A bent segmented trunk with ring
 * bands, a crown of drooping zig-zag fronds in two layers and a cluster of coconuts, flat-shaded and vertex-coloured.
 * The fronds sway in the vertex shader (a per-vertex `sway` = weight + phase, no CPU work), in the lit pass and the
 * shadow pass alike. Every copy has its own shape: its height, lean, turn and frond count are its params, the rest
 * comes from the placement group's rng stream (the old Palms.build loop's stream, so the move is exact). Built in its
 * own space: the foot of the trunk at the origin (the world sinks it 0.2 m into the sand, src/shards/driftwood-isle/world/Palms.ts).
 * The trunk collides as three capsules along its bent axis; the fronds are walk-through.
 */
import * as THREE from 'three';
import { islandKnobs } from '../tiers';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { windUniforms } from '@wildshard/engine/world/wind';

export interface PalmParams {
  /** trunk height, metres */
  readonly h: number;
  /** how far the trunk arches over (0 upright … 0.35) */
  readonly lean: number;
  /** which way it arches, radians about +Y */
  readonly leanDir: number;
  /** the trunk's and the crown's turn, radians */
  readonly rot: number;
  /** fronds in the drooping lower layer (the upper layer has 0.9× as many) */
  readonly fronds: number;
}

const C = {
  trunk: new THREE.Color('#8a6a48'), ring: new THREE.Color('#6d5238'),
  frond: new THREE.Color('#4f9a3a'), frondLight: new THREE.Color('#72b94c'), frondDark: new THREE.Color('#3b7d2c'),
  nut: new THREE.Color('#6b5a2e'), nutGreen: new THREE.Color('#7f9a3a'),
};

/** the trunk's bent axis at height share t (0 foot … 1 crown), own space: the lean grows with height and a slight S-bend */
function axisAt(p: PalmParams, t: number): THREE.Vector3 {
  const off = p.lean * p.h * (t * t - 0.12 * Math.sin(t * Math.PI));
  return new THREE.Vector3(Math.cos(p.leanDir) * off, p.h * t, Math.sin(p.leanDir) * off);
}

/** one palm's geometry in own space: position, colour and the sway attribute (non-indexed, flat-shaded) */
function palmGeometry(p: PalmParams, rng: Rng): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], sway: number[] = [];
  const c = new THREE.Color();
  const phase = rng.range(0, Math.PI * 2);
  const face = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, wa: number, wb: number, wd: number): void => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
    for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
    sway.push(wa, phase, wb, phase, wd, phase);
  };
  // ── trunk: 11 segments, 6 sides, thinner at the top ──
  const segs = 11, sides = 6;
  const rings: THREE.Vector3[][] = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs, r = 0.3 * (1 - t * 0.45) * (s % 2 ? 0.94 : 1.16) * (s === 0 ? 1.25 : 1), centre = axisAt(p, t);
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
  const top = axisAt(p, 1);
  // ── crown: fronds radiating out and drooping, zig-zag leaflet edges ──
  // two layers (E43: twice the fronds): the long drooping skirt, then a shorter crown of younger fronds on top
  const n = p.fronds, n2 = Math.round(n * 0.9);
  for (let f = 0; f < n + n2; f++) {
    const upper = f >= n, fi = upper ? f - n + 0.5 : f, nn = upper ? n2 : n;
    const ang = (fi / nn) * Math.PI * 2 + p.rot + rng.range(-0.15, 0.15);
    const tilt = upper ? rng.range(-0.45, -0.2) : rng.range(-0.1, 0.35);   // the young fronds stand up, some old ones droop low
    const L = upper ? rng.range(2.2, 3.0) : rng.range(3.2, 4.3), fs = islandKnobs().palmFrondSegs; // 6 desktop / 4 phone segments per frond
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const side = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    const shade = rng.next();
    const fc = shade < 0.3 ? C.frondDark : shade > 0.75 ? C.frondLight : C.frond;
    const spine = (t: number): THREE.Vector3 => { const y = 0.9 * Math.sin(t * Math.PI * 0.55) - (1.4 + tilt * 2.2) * t * t + 0.15; return new THREE.Vector3(top.x + dir.x * L * t, top.y + y, top.z + dir.z * L * t); };
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
  // ── coconuts: a cluster under the crown (5–7, brown and green) ──
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
  return geo;
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

/** the palms' material and the matching shadow-pass one: one pair per shard, so every copy merges into one draw */
function palmMaterials(ctx: ModelContext): { lit: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial } {
  return ctx.once('driftwood-isle/palm:materials', () => {
    const lit = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    patchShader(lit, 'driftwood.palm-sway', PATCH_ORDER.material, (shader) => { attachFogUniforms(shader); patchPalmSway(shader); }, { mode: 'replace', key: 'palms-sway' });
    ctx.sky.setupMaterial(lit);
    // the shadow pass sways the fronds too, so the palm shadows on the sand move (M5)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    patchShader(depth, 'driftwood.palm-sway-depth', PATCH_ORDER.material, (shader) => { patchPalmSway(shader); }, { mode: 'replace', key: 'palms-sway-depth' });
    return { lit, depth };
  });
}

/**
 * The trunk's collision, own space: three capsules whose segments run along the bent axis (t 0 → ⅓ → ⅔ → 1, the first
 * sunk 0.3 m into the ground), each as thick as the trunk's rings at its lower end (0.3 m tapering by 45 % to the crown).
 */
function trunkCapsules(p: PalmParams): ColliderDesc[] {
  const out: ColliderDesc[] = [];
  const cuts = [0, 1 / 3, 2 / 3, 1];
  for (let k = 0; k < 3; k++) {
    const t0 = cuts[k] ?? 0, t1 = cuts[k + 1] ?? 1;
    const p0 = axisAt(p, t0), p1 = axisAt(p, t1);
    if (k === 0) p0.y -= 0.3;
    const along = p1.clone().sub(p0), len = along.length(), radius = 0.3 * (1 - t0 * 0.45);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.divideScalar(len));
    out.push({ kind: 'capsule', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2, halfHeight: len / 2, radius, rot: { x: q.x, y: q.y, z: q.z, w: q.w } });
  }
  return out;
}

export const palm = defineModel<PalmParams>({
  id: 'driftwood-isle/palm', name: 'Coconut palm', category: 'nature', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/palm.ts', surface: 'wood',
  defaults: { h: 8, lean: 0.2, leanDir: 0, rot: 0, fronds: 11 },
  variants: [
    { id: 'tall', label: 'Tall', params: {} },
    { id: 'young', label: 'Young', params: { h: 5.5, lean: 0.1, fronds: 9 } },
    { id: 'leaning', label: 'Leaning', params: { h: 9.5, lean: 0.35, fronds: 13 } },
  ],
  seed: 0x5ea1 ^ 0x9a,
  build: (ctx, p, rng) => {
    const { lit, depth } = palmMaterials(ctx);
    return [{ geometry: palmGeometry(p, rng), material: lit, castShadow: true, receiveShadow: true, customDepthMaterial: depth }];
  },
  colliders: (p) => trunkCapsules(p),
});
