import * as THREE from 'three';
import { CHUNK_HALF, SEED } from '../core/config';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep, lerp } from '../core/noise';
import { heightAt, normalAt, splatAt, trailDistance, cabinMask, inChunk, pondMask, waterLevel, POND } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { windUniforms } from './TreeFactory';
import type { Sky } from './Sky';
import { noReflect } from './Water';
import type { Forest } from './Forest';
import { TIER_CONFIG } from '../core/tier';
import { CelledInstances } from './Culling';

/**
 * Forest-floor undergrowth: instanced ferns, low round-leaf shrubs and needle/twig litter.
 *
 *   const under = new Undergrowth(sky, forest).build();
 *   scene.add(under.group);
 *   game.onUpdate((dt) => under.update(dt, player.position));   // only feeds the viewer position uniform
 *
 * Everything is placed once, deterministically (Rng), chunk-wide:
 *  - ~6000 ferns (9 arched frond quads in a rosette, procedural pinnate-leaf alpha texture) in
 *    shaded forest floor, along trail verges (5.5–10 m from the centreline) and around the pond:
 *    not on rock / cabin pads / inside trunks / in the water. Cast + receive shadows.
 *  - ~1500 shrubs (4 crossed quads, round-leaf texture) at floor/grass edges.
 *  - ~5000 twig/needle-litter quads and ~3000 dark pebble clusters lying flat under the trees.
 *  - ~3000 moss patches (flat, soft mottled alpha) hugging the base of trunks.
 *  - ~1500 reed / sedge clumps (tall thin blades, 0.8–1.2 m) on the pond shore and in the shallows.
 * Six draw calls (+ fern & shrub shadow passes). Instances scale to 0 beyond `fadeFar` metres
 * in the vertex shader so distant ones cost nothing in the fragment stage.
 *
 * Public: `group`, `ferns`, `shrubs`, `litter`, `stones`, `moss`, `reeds` (InstancedMesh), `counts`.
 */

const FERN_MAX = 6000, SHRUB_MAX = 1500, LITTER_MAX = 5000, STONE_MAX = 3000, MOSS_MAX = 3000, REED_MAX = 1500;
const FADE_FAR = TIER_CONFIG.undergrowthFar, FADE_BAND = Math.min(25, FADE_FAR * 0.3);

const underUniforms = {
  uFadeFar: { value: FADE_FAR },
  uFadeBand: { value: FADE_BAND },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.93, 0.8) },
  uViewerPos: { value: new THREE.Vector3() },   // the player's camera (shadow passes see the light's cameraPosition)
};

const UP = new THREE.Vector3(0, 1, 0);

export class Undergrowth {
  group = new THREE.Group();
  ferns!: THREE.InstancedMesh;
  shrubs!: THREE.InstancedMesh;
  litter!: THREE.InstancedMesh;
  stones!: THREE.InstancedMesh;
  moss!: THREE.InstancedMesh;
  reeds!: THREE.InstancedMesh;
  counts = { ferns: 0, shrubs: 0, litter: 0, stones: 0, moss: 0, reeds: 0 };

  constructor(private sky: Sky, private forest: Forest) {}

  build(): this {
    underUniforms.uSunDir.value.copy(this.sky.sunDir);
    underUniforms.uSunColor.value.copy(this.sky.sunColor);
    const fernTex = makeFernTexture(), shrubTex = makeShrubTexture(), litterTex = makeLitterTexture();
    const fernMat = this.makeMaterial(fernTex, 'fern', 0.35, 0.5);
    const shrubMat = this.makeMaterial(shrubTex, 'shrub', 0.25, 0.5);
    const litterMat = this.makeMaterial(litterTex, 'litter', 0.0, 0.35);
    litterMat.roughness = 1;
    const stoneTex = makeStoneTexture(), mossTex = makeMossTexture(), reedTex = makeReedTexture();
    const stoneMat = this.makeMaterial(stoneTex, 'stone', 0.0, 0.5);
    stoneMat.roughness = 0.75;
    const mossMat = this.makeMaterial(mossTex, 'moss', 0.0, 0.4);
    mossMat.roughness = 1;
    // flat ground layers: pull towards the camera so the terrain mesh (±5 cm off heightAt) never swallows them
    for (const m of [litterMat, stoneMat, mossMat]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    const reedMat = this.makeMaterial(reedTex, 'reed', 0.5, 0.45);

    const place = this.place();
    this.ferns = this.makeInstanced(buildFernGeometry(), fernMat, place.ferns, true, fernTex, 0.35);
    this.shrubs = this.makeInstanced(buildShrubGeometry(), shrubMat, place.shrubs, true, shrubTex, 0.25);
    this.litter = this.makeInstanced(buildLitterGeometry(1.4), litterMat, place.litter, false);
    this.stones = this.makeInstanced(buildLitterGeometry(0.9), stoneMat, place.stones, false);
    this.moss = this.makeInstanced(buildLitterGeometry(1.0), mossMat, place.moss, false);
    this.reeds = this.makeInstanced(buildReedGeometry(), reedMat, place.reeds, true, reedTex, 0.5);
    this.counts = { ferns: place.ferns.length, shrubs: place.shrubs.length, litter: place.litter.length, stones: place.stones.length, moss: place.moss.length, reeds: place.reeds.length };
    this.group.add(this.ferns, this.shrubs, this.litter, this.stones, this.moss, this.reeds);
    noReflect(this.group);
    return this;
  }

  update(_dt: number, playerPos: THREE.Vector3): void { underUniforms.uViewerPos.value.copy(playerPos); }

  private makeInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Placement[], shadow: boolean, tex?: THREE.Texture, wind = 0) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    const castShadow = shadow && TIER_CONFIG.undergrowthShadows;
    mesh.castShadow = castShadow;
    if (castShadow && tex) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
      depth.onBeforeCompile = (shader) => { patchUndergrowthVertex(shader, wind); };
      depth.customProgramCacheKey = () => 'under-depth'; // wind is a uniform: one depth program for every kind
      mesh.customDepthMaterial = depth;
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), n = new THREE.Vector3();
    const all = new Float32Array(items.length * 16), cols = new Float32Array(items.length * 3), pos = new Float32Array(items.length * 3);
    items.forEach((it, i) => {
      n.set(it.nx, it.ny, it.nz);
      q2.setFromUnitVectors(UP, n);
      q.setFromAxisAngle(UP, it.rot).premultiply(q2);
      m.compose(p.set(it.x, it.y, it.z), q, s.set(it.scale, it.scale, it.scale));
      m.toArray(all, i * 16);
      cols[i * 3] = it.r; cols[i * 3 + 1] = it.g; cols[i * 3 + 2] = it.b;
      pos[i * 3] = it.x; pos[i * 3 + 1] = it.y; pos[i * 3 + 2] = it.z;
    });
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
    mesh.count = 0;
    // one draw call, but only the instances in the padded view frustum and inside the fade radius are live
    const culled = new CelledInstances(mesh, all, cols, pos, FADE_FAR + 2, 32, 2.5);
    this.forest.onViewChange((f, v) => culled.cull(f, v));
    return mesh;
  }

  private makeMaterial(tex: THREE.Texture, key: string, wind: number, alphaTest: number) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    mat.name = `under-${key}`;
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
    mat.customProgramCacheKey = () => 'under'; // `key` names the material; wind is a uniform, so every kind shares ONE program (was 6 — ~150 ms each on iOS)
    this.sky.setupMaterial(mat);
    return mat;
  }

  // ------------------------------------------------------------------ placement
  private place() {
    const rng = new Rng(SEED + 77);
    const cluster = new Noise2D(SEED + 78);
    const ferns: Placement[] = [], shrubs: Placement[] = [], litter: Placement[] = [], stones: Placement[] = [], moss: Placement[] = [], reeds: Placement[] = [];
    const half = CHUNK_HALF - 8;
    const wl = waterLevel();
    type Kind = 'fern' | 'shrub' | 'litter' | 'stone' | 'moss' | 'reed';
    const tryPlace = (kind: Kind, x: number, z: number) => {
      if (!inChunk(x, z, 8)) return;
      const td = trailDistance(x, z);
      const pm = pondMask(x, z);
      const y = heightAt(x, z);
      const depth = wl - y;                       // > 0 under water
      if (kind === 'reed') {
        if (depth < -0.55 || depth > 0.35 || pm < 0.05) return;
      } else {
        if (depth > -0.1) return;                  // nothing else grows in the water
        if (td < (kind === 'litter' || kind === 'stone' ? 3 : 5.5)) return;
        if (cabinMask(x, z) > 0.02) return;
      }
      const c = cluster.fbm(x * 0.02 + (kind === 'shrub' ? 40 : 0), z * 0.02, 3);
      const verge = td < 10 || (pm > 0.03 && depth < -0.1);   // trail edge or pond rim: ferns like it here
      if (kind === 'fern' && c < 0.12 && !verge) return;
      if (kind === 'shrub' && c < -0.1) return;
      const near = this.forest.nearby(x, z, 12);
      let canopy = 0, trunkD = 1e9;
      for (const t of near) { const d = Math.hypot(t.x - x, t.z - z); if (d < t.r + (kind === 'moss' ? 0.1 : 0.45)) return; if (d < 12) canopy++; trunkD = Math.min(trunkD, d - t.r); }
      if (kind === 'fern' && canopy < 2 && !verge) return;
      if ((kind === 'litter' || kind === 'stone') && canopy < 1) return;
      if (kind === 'moss' && trunkD > 2.2) return;
      const nrm = normalAt(x, z, 0.8);
      if (nrm[1] < (kind === 'moss' ? 0.7 : 0.8)) return;
      const [f, g, r, t] = splatAt(x, z);
      if (r > (kind === 'stone' || kind === 'moss' ? 0.6 : 0.25)) return;
      if (kind === 'fern' && f < 0.55 && !(verge && t < 0.5 && f + g > 0.4)) return;
      if (kind === 'shrub' && f + g < 0.6) return;
      if (kind === 'litter' && f < 0.5) return;
      if (kind === 'stone' && f + r < 0.5) return;
      const hue = rng.next();
      const base = { x, y, z, nx: nrm[0], ny: nrm[1], nz: nrm[2], rot: rng.range(0, Math.PI * 2) };
      if (kind === 'fern') {
        const scale = rng.range(0.9, 1.6) * (0.8 + 0.2 * smoothstep(0, 0.5, c));
        ferns.push({ ...base, y: y - 0.02, scale, r: lerp(0.5, 0.78, hue), g: lerp(0.72, 0.82, hue), b: lerp(0.48, 0.6, hue) });
      } else if (kind === 'shrub') {
        shrubs.push({ ...base, y: y - 0.03, scale: rng.range(0.8, 1.5), r: lerp(0.8, 1.0, hue), g: lerp(0.9, 0.8, hue), b: lerp(0.6, 0.55, hue) });
      } else if (kind === 'litter') {
        litter.push({ ...base, y: y + 0.06, scale: rng.range(0.8, 1.5), r: lerp(0.7, 0.9, hue), g: lerp(0.68, 0.82, hue), b: lerp(0.62, 0.75, hue) });
      } else if (kind === 'stone') {
        stones.push({ ...base, y: y + 0.06, scale: rng.range(0.6, 1.3), r: lerp(0.75, 1.0, hue), g: lerp(0.75, 0.98, hue), b: lerp(0.75, 0.95, hue) });
      } else if (kind === 'moss') {
        moss.push({ ...base, y: y + 0.05, scale: rng.range(0.7, 1.6), r: lerp(0.6, 0.85, hue), g: lerp(0.62, 0.78, hue), b: lerp(0.5, 0.62, hue) });
      } else {
        reeds.push({ ...base, y: y - 0.05, scale: rng.range(0.8, 1.2) * (depth > 0 ? 1.1 : 1), r: lerp(0.75, 1.0, hue), g: lerp(0.85, 0.95, hue), b: lerp(0.45, 0.6, hue) });
      }
    };
    const anywhere = (kind: Kind) => tryPlace(kind, rng.range(-half, half), rng.range(-half, half));
    for (let i = 0; i < 30000 && ferns.length < FERN_MAX * 0.7; i++) anywhere('fern');
    // trail verges + pond rim: sample near the trails / pond directly so the verge fills up
    for (let i = 0; i < 12000 && ferns.length < FERN_MAX; i++) {
      if (rng.next() < 0.75) {
        const x = rng.range(-half, half), z = rng.range(-half, half);
        tryPlace('fern', x, z);
      } else {
        const a = rng.range(0, Math.PI * 2), d = POND.r + rng.range(-4, 14);
        tryPlace('fern', POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d);
      }
    }
    for (let i = 0; i < 9000 && shrubs.length < SHRUB_MAX; i++) anywhere('shrub');
    for (let i = 0; i < 18000 && litter.length < LITTER_MAX; i++) anywhere('litter');
    for (let i = 0; i < 12000 && stones.length < STONE_MAX; i++) anywhere('stone');
    // moss: sample right at the trunks
    for (let i = 0; i < 14000 && moss.length < MOSS_MAX; i++) {
      const t = rng.pick(this.forest.trees);
      const a = rng.range(0, Math.PI * 2), d = t.r + rng.range(0.15, 1.6);
      tryPlace('moss', t.x + Math.cos(a) * d, t.z + Math.sin(a) * d);
    }
    for (let i = 0; i < 40000 && reeds.length < REED_MAX; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(POND.r * 0.3, POND.r + 10);
      tryPlace('reed', POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d);
    }
    return { ferns, shrubs, litter, stones, moss, reeds };
  }
}

interface Placement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number }

/** Distance fade (scale to 0) + gentle wind, shared by the lit and the shadow-depth materials. */
function patchUndergrowthVertex(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, wind: number) {
  shader.uniforms['uWindScale'] = { value: wind }; // per material, not baked into the source: the program is shared
  shader.uniforms['uTime'] = windUniforms.uTime;
  shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
  shader.uniforms['uFadeFar'] = underUniforms.uFadeFar;
  shader.uniforms['uFadeBand'] = underUniforms.uFadeBand;
  shader.uniforms['uViewerPos'] = underUniforms.uViewerPos;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', /* glsl */`#include <common>
      uniform float uTime; uniform float uWindStrength; uniform float uWindScale; uniform float uFadeFar; uniform float uFadeBand; uniform vec3 uViewerPos;
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
        float amp = ( 0.01 + gust * 0.05 ) * uWindStrength * uWindScale * 4.0;
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

/** One flat quad of `size` metres lying on the ground (pivot centre). */
function buildLitterGeometry(size: number) {
  const h = size / 2;
  const verts = [-h, 0, -h, h, 0, -h, -h, 0, h, h, 0, h];
  const norms = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const uvs = [0, 1, 1, 1, 0, 0, 1, 0];
  return toGeometry(verts, norms, uvs, [0, 2, 1, 1, 2, 3]);
}

/** Reed / sedge clump: 3 crossed narrow quads, 1 m tall (scaled 0.8–1.2 per instance). */
function buildReedGeometry() {
  const rng = new Rng(SEED + 608);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let q = 0; q < 3; q++) {
    const yaw = (q / 3) * Math.PI + rng.range(-0.2, 0.2);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const w = 0.3 * rng.range(0.85, 1.15), bend = rng.range(0.05, 0.12);
    const base = verts.length / 3;
    for (let r = 0; r < 4; r++) {
      const t = r / 3;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * w, lz = bend * t * t;
        const x = lx * cy - lz * sy, z = lx * sy + lz * cy;
        verts.push(x, t, z); upNormal(x, z, norms); uvs.push(c, t);
      }
    }
    for (let r = 0; r < 3; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return toGeometry(verts, norms, uvs, idx);
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

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[undergrowth] no 2d canvas context');
  return g;
}

/** Pinnate fern frond: base at the bottom, tip at the top. */
function makeFernTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
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
  grad.addColorStop(0, `rgb(${52 + hue * 6},${82 + hue * 8},34)`);
  grad.addColorStop(1, `rgb(${78 + hue * 10 + t * 26},${116 + hue * 10 + t * 18},${46 + hue * 6})`);
  g.fillStyle = grad;
  g.beginPath();
  left.forEach(([lx, ly], i) => { if (i === 0) g.moveTo(lx, ly); else g.lineTo(lx, ly); });
  for (let i = right.length - 1; i >= 0; i--) { const r = right[i]; if (r) g.lineTo(r[0], r[1]); }
  g.closePath(); g.fill();
  // pinna midrib
  g.strokeStyle = 'rgba(150,170,80,0.55)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * len * 0.95, by + dy * len * 0.95); g.stroke();
}

/** Round-leaf shrub: twigs from the bottom with ~45 leaves. */
function makeShrubTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
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

/** Dark pebbles: a scatter of shaded grey ellipses with a light rim. */
function makeStoneTexture() {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 704);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(24, W - 24), y = rng.range(24, H - 24), rx = rng.range(7, 16), ry = rx * rng.range(0.6, 0.9), a = rng.range(0, Math.PI);
    const v = rng.range(0, 1);
    const grad = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, rx);
    grad.addColorStop(0, `rgb(${96 + v * 40},${94 + v * 38},${90 + v * 34})`);
    grad.addColorStop(1, `rgb(${34 + v * 14},${33 + v * 12},${32 + v * 10})`);
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}

/** Moss: a velvety stipple of tiny dark-green tufts, dense in the middle, ragged at the edge. */
function makeMossTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 705);
  // base cushion
  for (let i = 0; i < 40; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.8 * S * 0.28;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(10, 26);
    const v = rng.range(0, 1);
    g.fillStyle = `rgb(${30 + v * 16},${52 + v * 22},${18 + v * 8})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // tufts: dense in the middle, thinning outwards, brighter specks on top
  for (let i = 0; i < 3200; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.55 * S * 0.47;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(1.2, 3.6);
    const v = rng.range(0, 1), bright = rng.next() < 0.18;
    g.fillStyle = bright ? `rgb(${92 + v * 30},${122 + v * 30},${44 + v * 10})` : `rgb(${34 + v * 26},${58 + v * 34},${20 + v * 10})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}

/** Reed blades: a few tall, very thin, slightly bent blades with brown seed heads. */
function makeReedTexture() {
  const W = 128, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 706);
  g.lineCap = 'round';
  for (let b = 0; b < 7; b++) {
    const x0 = 14 + (b / 6) * 100 + rng.range(-6, 6), top = rng.range(20, 110), bendX = rng.range(-22, 22);
    const v = rng.range(0, 1);
    g.strokeStyle = `rgb(${96 + v * 40},${120 + v * 30},${40 + v * 16})`;
    g.lineWidth = rng.range(3.5, 5.5);
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + bendX * 0.4, (H + top) / 2, x0 + bendX, top); g.stroke();
    if (b % 3 === 0) {  // seed head
      g.fillStyle = `rgb(${110 + v * 30},${70 + v * 20},36)`;
      g.beginPath(); g.ellipse(x0 + bendX, top + 6, 4.5, 16, bendX * 0.01, 0, Math.PI * 2); g.fill();
    }
  }
  return canvasTexture(c);
}

/** Fallen needles, twigs and a few leaves on a transparent background. */
function makeLitterTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 703);
  g.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30), a = rng.range(0, Math.PI), l = rng.range(30, 70);
    const hue = rng.range(0, 1);
    g.strokeStyle = `rgba(${74 + hue * 42},${50 + hue * 24},${26 + hue * 10},1.0)`;
    g.lineWidth = rng.range(2.5, 4.2);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(40, W - 40), y = rng.range(40, H - 40), a = rng.range(0, Math.PI), l = rng.range(60, 170);
    g.strokeStyle = `rgb(${62 + rng.range(0, 30)},${46 + rng.range(0, 20)},28)`;
    g.lineWidth = rng.range(5, 9);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    g.lineTo(x + rng.range(-10, 10), y + rng.range(-10, 10)); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30);
    g.fillStyle = `rgb(${100 + rng.range(0, 40)},${68 + rng.range(0, 24)},36)`;
    g.beginPath(); g.ellipse(x, y, rng.range(9, 15), rng.range(5, 8), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}
