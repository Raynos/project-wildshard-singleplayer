import * as THREE from 'three';
import { CHUNK_HALF, SEED } from '../core/config';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep, lerp } from '../core/noise';
import { heightAt, normalAt, splatAt, trailDistance, cabinMask, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { windUniforms } from './TreeFactory';
import type { Sky } from './Sky';
import type { Forest } from './Forest';

/**
 * Forest-floor undergrowth: instanced ferns, low round-leaf shrubs and needle/twig litter.
 *
 *   const under = new Undergrowth(sky, forest).build();
 *   scene.add(under.group);
 *   game.onUpdate((dt) => under.update(dt, player.position));   // only feeds the viewer position uniform
 *
 * Everything is placed once, deterministically (Rng), chunk-wide:
 *  - ~4000 ferns (9 arched frond quads in a rosette, procedural pinnate-leaf alpha texture) in
 *    shaded forest floor: high floor splat weight, ≥ 2 trees within 12 m, > 5 m from trails,
 *    not on rock / cabin pads / inside trunks, clustered by a noise field. Cast + receive shadows.
 *  - ~1500 shrubs (4 crossed quads, round-leaf texture) at floor/grass edges.
 *  - ~2500 twig-litter quads lying flat under the trees (no shadow, cheap).
 * Three draw calls (+ fern & shrub shadow passes). Instances scale to 0 beyond `fadeFar` metres
 * in the vertex shader so distant ones cost nothing in the fragment stage.
 *
 * Public: `group`, `ferns`, `shrubs`, `litter` (InstancedMesh), `counts`.
 */

const FERN_MAX = 5000, SHRUB_MAX = 1500, LITTER_MAX = 2500;
const FADE_FAR = 110, FADE_BAND = 25;

const underUniforms = {
  uFadeFar: { value: FADE_FAR },
  uFadeBand: { value: FADE_BAND },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.93, 0.8) },
  uViewerPos: { value: new THREE.Vector3() },   // the player's camera (shadow passes see the light's cameraPosition)
};

export class Undergrowth {
  group = new THREE.Group();
  ferns!: THREE.InstancedMesh;
  shrubs!: THREE.InstancedMesh;
  litter!: THREE.InstancedMesh;
  counts = { ferns: 0, shrubs: 0, litter: 0 };

  constructor(private sky: Sky, private forest: Forest) {}

  build() {
    underUniforms.uSunDir.value.copy(this.sky.sunDir);
    underUniforms.uSunColor.value.copy(this.sky.sunColor);
    const fernTex = makeFernTexture(), shrubTex = makeShrubTexture(), litterTex = makeLitterTexture();
    const fernMat = this.makeMaterial(fernTex, 'fern', 0.35, 0.5);
    const shrubMat = this.makeMaterial(shrubTex, 'shrub', 0.25, 0.5);
    const litterMat = this.makeMaterial(litterTex, 'litter', 0.0, 0.35);
    litterMat.roughness = 1;

    const place = this.place();
    this.ferns = this.makeInstanced(buildFernGeometry(), fernMat, place.ferns, true, fernTex, 0.35);
    this.shrubs = this.makeInstanced(buildShrubGeometry(), shrubMat, place.shrubs, true, shrubTex, 0.25);
    this.litter = this.makeInstanced(buildLitterGeometry(), litterMat, place.litter, false);
    this.counts = { ferns: place.ferns.length, shrubs: place.shrubs.length, litter: place.litter.length };
    this.group.add(this.ferns, this.shrubs, this.litter);
    return this;
  }

  update(_dt: number, playerPos: THREE.Vector3) { underUniforms.uViewerPos.value.copy(playerPos); }

  private makeInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Placement[], shadow: boolean, tex?: THREE.Texture, wind = 0) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    if (shadow && tex) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
      depth.onBeforeCompile = (shader) => { patchUndergrowthVertex(shader, wind); };
      depth.customProgramCacheKey = () => 'under-depth-' + wind;
      mesh.customDepthMaterial = depth;
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), n = new THREE.Vector3();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      n.set(it.nx, it.ny, it.nz);
      q2.setFromUnitVectors(UP, n);
      q.setFromAxisAngle(UP, it.rot).premultiply(q2);
      m.compose(p.set(it.x, it.y, it.z), q, s.set(it.scale, it.scale, it.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setRGB(it.r, it.g, it.b));
    });
    mesh.count = items.length;
    return mesh;
  }

  private makeMaterial(tex: THREE.Texture, key: string, wind: number, alphaTest: number) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, underUniforms);
      patchUndergrowthVertex(shader, wind);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          varying float vH;
          uniform vec3 uSunDir; uniform vec3 uSunColor;`)
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
          diffuseColor.rgb *= mix( 0.55, 1.0, smoothstep( 0.0, 0.5, vH ) );`)
        .replace('#include <alphatest_fragment>', /* glsl */`
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;`)
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
        .replace('#include <lights_fragment_begin>', /* glsl */`#include <lights_fragment_begin>
          {
            vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
            float bl = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 5.0 );
            reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.05 + bl * 0.35 ) * uSunColor;
          }`);
    };
    mat.customProgramCacheKey = () => 'under-' + key;
    this.sky.setupMaterial(mat);
    return mat;
  }

  // ------------------------------------------------------------------ placement
  private place() {
    const rng = new Rng(SEED + 77);
    const cluster = new Noise2D(SEED + 78);
    const ferns: Placement[] = [], shrubs: Placement[] = [], litter: Placement[] = [];
    const half = CHUNK_HALF - 8;
    const tmpN: [number, number, number] = [0, 1, 0];
    const tryPlace = (kind: 'fern' | 'shrub' | 'litter') => {
      const x = rng.range(-half, half), z = rng.range(-half, half);
      if (!inChunk(x, z, 8)) return;
      if (trailDistance(x, z) < (kind === 'litter' ? 3 : 5.5)) return;
      if (cabinMask(x, z) > 0.02) return;
      const c = cluster.fbm(x * 0.02 + (kind === 'shrub' ? 40 : 0), z * 0.02, 3);
      if (kind === 'fern' && c < 0.12) return;
      if (kind === 'shrub' && c < -0.1) return;
      const near = this.forest.nearby(x, z, 12);
      // shaded: under the canopy
      let canopy = 0;
      for (const t of near) { const d = Math.hypot(t.x - x, t.z - z); if (d < t.r + 0.45) return; if (d < 12) canopy++; }
      if (kind === 'fern' && canopy < 2) return;
      if (kind === 'litter' && canopy < 1) return;
      const nrm = normalAt(x, z, 0.8);
      if (nrm[1] < 0.8) return;
      const [f, g, r] = splatAt(x, z);
      if (r > 0.25) return;
      if (kind === 'fern' && f < 0.55) return;
      if (kind === 'shrub' && f + g < 0.6) return;
      if (kind === 'litter' && f < 0.5) return;
      const y = heightAt(x, z);
      tmpN[0] = nrm[0]; tmpN[1] = nrm[1]; tmpN[2] = nrm[2];
      const hue = rng.next();
      if (kind === 'fern') {
        const scale = rng.range(0.9, 1.6) * (0.8 + 0.2 * smoothstep(0, 0.5, c));
        ferns.push({ x, y: y - 0.02, z, nx: nrm[0], ny: nrm[1], nz: nrm[2], rot: rng.range(0, Math.PI * 2), scale,
          r: lerp(0.5, 0.78, hue), g: lerp(0.72, 0.82, hue), b: lerp(0.48, 0.6, hue) });
      } else if (kind === 'shrub') {
        shrubs.push({ x, y: y - 0.03, z, nx: nrm[0], ny: nrm[1], nz: nrm[2], rot: rng.range(0, Math.PI * 2), scale: rng.range(0.8, 1.5),
          r: lerp(0.8, 1.0, hue), g: lerp(0.9, 0.8, hue), b: lerp(0.6, 0.55, hue) });
      } else {
        litter.push({ x, y: y + 0.015, z, nx: nrm[0], ny: nrm[1], nz: nrm[2], rot: rng.range(0, Math.PI * 2), scale: rng.range(0.7, 1.4),
          r: lerp(0.85, 1.0, hue), g: lerp(0.8, 0.9, hue), b: lerp(0.7, 0.8, hue) });
      }
    };
    for (let i = 0; i < 32000 && ferns.length < FERN_MAX; i++) tryPlace('fern');
    for (let i = 0; i < 9000 && shrubs.length < SHRUB_MAX; i++) tryPlace('shrub');
    for (let i = 0; i < 9000 && litter.length < LITTER_MAX; i++) tryPlace('litter');
    return { ferns, shrubs, litter };
  }
}

interface Placement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number }
const UP = new THREE.Vector3(0, 1, 0);

/** Distance fade (scale to 0) + gentle wind, shared by the lit and the shadow-depth materials. */
function patchUndergrowthVertex(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, wind: number) {
  shader.uniforms.uTime = windUniforms.uTime;
  shader.uniforms.uWindStrength = windUniforms.uWindStrength;
  shader.uniforms.uFadeFar = underUniforms.uFadeFar;
  shader.uniforms.uFadeBand = underUniforms.uFadeBand;
  shader.uniforms.uViewerPos = underUniforms.uViewerPos;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', /* glsl */`#include <common>
      uniform float uTime; uniform float uWindStrength; uniform float uFadeFar; uniform float uFadeBand; uniform vec3 uViewerPos;
      varying float vH;`)
    .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
      {
        mat3 im = mat3( instanceMatrix );
        vec3 ipos = ( modelMatrix * vec4( instanceMatrix[3].xyz, 1.0 ) ).xyz;
        float dist = distance( ipos, uViewerPos );
        float fade = 1.0 - smoothstep( uFadeFar - uFadeBand, uFadeFar, dist );
        transformed *= fade;
        float h = uv.y;
        vH = h;
        float s2 = dot( im[0], im[0] );
        vec3 wpos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        float phase = wpos.x * 0.28 + wpos.z * 0.16;
        float gust = sin( uTime * 1.25 - phase ) * 0.5 + 0.5;
        gust *= gust;
        float flutter = sin( uTime * 5.0 + wpos.x * 3.0 + wpos.z * 2.0 );
        float amp = ( 0.01 + gust * 0.05 ) * uWindStrength * ${wind.toFixed(3)} * 4.0;
        float w = h * h;
        vec3 off = vec3( 0.86 * amp + flutter * 0.006, 0.0, 0.5 * amp + flutter * 0.004 ) * w;
        off.y = - length( off.xz ) * 0.3;
        transformed += ( off * im ) / max( s2, 1e-6 ) * fade;
      }`);
}

// ------------------------------------------------------------------ geometry

function upNormal(x: number, z: number, out: number[]) {
  const rl = Math.hypot(x, z) || 1;
  const nx = (x / rl) * 0.45, nz = (z / rl) * 0.45;
  const nl = Math.hypot(nx, 1, nz);
  out.push(nx / nl, 1 / nl, nz / nl);
}

/** Rosette of 9 arched frond quads (4 rows each), pivot at the crown. Unit ≈ 0.9 m frond length. */
function buildFernGeometry() {
  const rng = new Rng(SEED + 606);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  const rows = 5;
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const inner = f >= 6;
    const yaw = (f / (inner ? 3 : 6)) * Math.PI * 2 + rng.range(-0.3, 0.3) + (inner ? 0.5 : 0);
    const len = (inner ? 0.62 : 0.9) * rng.range(0.85, 1.15);
    const width = len * 0.42;
    const tiltUp = inner ? rng.range(0.9, 1.2) : rng.range(0.35, 0.6);   // radians above horizontal at the base
    const droop = rng.range(0.9, 1.4);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const base = verts.length / 3;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      // arch: leaves the crown at tiltUp, bends over with droop
      const ang = tiltUp - droop * t * t;
      // integrate a little along the curve for the profile
      let px = 0, py = 0.05;
      const steps = 6;
      for (let s = 0; s < steps; s++) { const tt = (t * s) / steps; const a = tiltUp - droop * tt * tt; px += Math.cos(a) * (len * t) / steps; py += Math.sin(a) * (len * t) / steps; }
      void ang;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * width * Math.sin(Math.min(1, t * 1.6 + 0.15) * Math.PI * 0.5 + 0.2);
        const x = px * cy - lx * sy, z = px * sy + lx * cy;
        verts.push(x, py, z);
        upNormal(x, z, norms);
        uvs.push(c, t);
      }
    }
    for (let r = 0; r < rows - 1; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return toGeometry(verts, norms, uvs, idx);
}

/** 4 crossed quads, 0.95 m wide, 0.75 m tall. */
function buildShrubGeometry() {
  const rng = new Rng(SEED + 607);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let q = 0; q < 4; q++) {
    const yaw = (q / 4) * Math.PI + rng.range(-0.2, 0.2);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const w = 0.95 * rng.range(0.85, 1.15), h = 0.75 * rng.range(0.85, 1.15);
    const base = verts.length / 3;
    for (let r = 0; r < 3; r++) {
      const t = r / 2;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * w, lz = rng.range(-0.02, 0.02) + t * t * 0.08;
        const x = lx * cy - lz * sy, z = lx * sy + lz * cy;
        verts.push(x, t * h, z); upNormal(x, z, norms); uvs.push(c, t);
      }
    }
    for (let r = 0; r < 2; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return toGeometry(verts, norms, uvs, idx);
}

/** One flat 1.4 m quad lying on the ground (pivot centre). */
function buildLitterGeometry() {
  const verts = [-0.7, 0, -0.7, 0.7, 0, -0.7, -0.7, 0, 0.7, 0.7, 0, 0.7];
  const norms = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const uvs = [0, 1, 1, 1, 0, 0, 1, 0];
  return toGeometry(verts, norms, uvs, [0, 2, 1, 1, 2, 3]);
}

function toGeometry(verts: number[], norms: number[], uvs: number[], idx: number[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ------------------------------------------------------------------ textures

function canvasTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Pinnate fern frond: base at the bottom, tip at the top. */
function makeFernTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  const rng = new Rng(SEED + 701);
  const stemX = (t: number) => 128 + Math.sin(t * 2.2) * 6;
  const stemY = (t: number) => 512 - 6 - t * (512 - 18);
  const pairs = 19;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    // pinna length peaks around 30 % up the frond, vanishes at the tip
    const lenF = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6 * (1 - t * 0.35);
    const len = 12 + lenF * 100;
    const wid = 5 + lenF * 8;
    for (const side of [-1, 1]) {
      const bx = stemX(t), by = stemY(t) + side * 3;
      const ang = side * (0.62 - t * 0.25) + rng.range(-0.08, 0.08); // sweep upward
      drawPinna(g, bx, by, ang * side, len, wid, side, t, rng);
    }
  }
  // stem
  g.strokeStyle = 'rgb(88,96,42)'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(stemX(0), stemY(0));
  for (let i = 1; i <= 20; i++) { const t = i / 20; g.lineTo(stemX(t), stemY(t)); }
  g.stroke();
  return canvasTexture(c);
}

function drawPinna(g: CanvasRenderingContext2D, bx: number, by: number, ang: number, len: number, wid: number, side: number, t: number, rng: Rng) {
  // axis direction: outward (side) and slightly upward
  const dx = side * Math.cos(ang), dy = -Math.sin(ang) * 0.9;
  const nx = -dy, ny = dx;
  const steps = 26;
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const w = wid * Math.sin(Math.min(1, s * 1.1) * Math.PI) ** 0.55 * (1 - s * 0.15);
    const serr = (i % 2 ? 0.7 : 1.0);  // lobed pinnule edge
    const ax = bx + dx * len * s, ay = by + dy * len * s;
    left.push([ax + nx * w * serr, ay + ny * w * serr]);
    right.push([ax - nx * w * serr, ay - ny * w * serr]);
  }
  const hue = rng.range(-1, 1);
  const grad = g.createLinearGradient(bx, by, bx + dx * len, by + dy * len);
  grad.addColorStop(0, `rgb(${52 + hue * 6},${82 + hue * 8},${34})`);
  grad.addColorStop(1, `rgb(${78 + hue * 10 + t * 26},${116 + hue * 10 + t * 18},${46 + hue * 6})`);
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) g.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath(); g.fill();
  // pinna midrib
  g.strokeStyle = 'rgba(150,170,80,0.55)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * len * 0.95, by + dy * len * 0.95); g.stroke();
}

/** Round-leaf shrub: twigs from the bottom with ~45 leaves. */
function makeShrubTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rng = new Rng(SEED + 702);
  const twigs = 5;
  const leafSpots: [number, number, number][] = [];
  for (let t = 0; t < twigs; t++) {
    const ang = -Math.PI / 2 + (t - (twigs - 1) / 2) * 0.42 + rng.range(-0.1, 0.1);
    let x = W / 2 + rng.range(-20, 20), y = H - 10;
    g.strokeStyle = 'rgb(78,62,40)'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y);
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const a = ang + rng.range(-0.25, 0.25) + (s / segs) * (t - 2) * 0.2;
      x += Math.cos(a) * 60; y += Math.sin(a) * 60;
      g.lineTo(x, y);
      if (s > 0) for (let l = 0; l < 4; l++) leafSpots.push([x + rng.range(-34, 34), y + rng.range(-28, 28), rng.range(12, 22)]);
    }
    g.stroke();
  }
  for (const [x, y, r] of leafSpots) {
    const hue = rng.range(-1, 1);
    const light = rng.range(0, 1);
    g.fillStyle = `rgb(${70 + hue * 10 + light * 40},${104 + hue * 8 + light * 44},${38 + hue * 6 + light * 10})`;
    g.beginPath(); g.ellipse(x, y, r, r * rng.range(0.75, 1), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(170,190,90,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y + r * 0.8); g.lineTo(x, y - r * 0.8); g.stroke();
  }
  return canvasTexture(c);
}

/** Fallen needles, twigs and a few leaves on a transparent background. */
function makeLitterTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rng = new Rng(SEED + 703);
  g.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30), a = rng.range(0, Math.PI), l = rng.range(30, 70);
    const hue = rng.range(0, 1);
    g.strokeStyle = `rgba(${95 + hue * 55},${58 + hue * 34},${26 + hue * 14},1.0)`;
    g.lineWidth = rng.range(2.5, 4.2);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = rng.range(40, W - 40), y = rng.range(40, H - 40), a = rng.range(0, Math.PI), l = rng.range(60, 150);
    g.strokeStyle = `rgb(${80 + rng.range(0, 30)},${58 + rng.range(0, 20)},${36})`;
    g.lineWidth = rng.range(4, 7);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    g.lineTo(x + rng.range(-10, 10), y + rng.range(-10, 10)); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30);
    g.fillStyle = `rgb(${130 + rng.range(0, 50)},${80 + rng.range(0, 30)},${35})`;
    g.beginPath(); g.ellipse(x, y, rng.range(9, 15), rng.range(5, 8), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}
