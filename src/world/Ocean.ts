/**
 * Ocean v2 — the faceted, stylized sea of an open-water shard (`ChunkDef.ocean`, Driftwood Isle; DRIFTWOOD-REMASTER
 * W1 + W2 + W3).
 *
 *   const ocean = new Ocean(sky).build();   // reads getActiveChunk().ocean
 *   scene.add(ocean.group);                 // ocean.mesh is the surface
 *   ocean.foamAround(player.colliders);     // foam rings wherever a collider box pierces the surface (piles, rocks, hulls)
 *   game.onUpdate((dt) => ocean.update(dt));
 *
 * One mesh: a grid 2.75 m fine (phone: 4 m) over the chunk (plus a margin) that coarsens geometrically out to ~4 km.
 * - **waves** (W3): four Gerstner waves from `waves.ts` — the same function the boat / swimmer / debris call in TS —
 *   damped over the sand; flat shading tilts every facet as they roll.
 * - **depth** (W1): a 512² sea-floor texture baked from the heightfield at build (R = floor height, G = obstacle
 *   proximity) — per-pixel depth with no depth pre-pass. Beer–Lambert: the water's opacity grows with the view path
 *   through it (depth / |V.y|), so the shallows are clear and the sand, coral and fish show from the pier, then turquoise,
 *   then deep blue. Premultiplied alpha: the lit water body + the reflection are added over the seabed.
 * - **light**: the water body goes through the shard's toon lighting (stylize.ts: lit band / blue-violet shade, so the
 *   pier's shadow lies on the water); on top, a Schlick-fresnel reflection of the sky dome's gradient and a crisp sun
 *   glint that sparkles facet by facet.
 * - **foam** (W2): a breaking band on the shore that breathes with the swell, lines that march in over the shallows,
 *   sparse caps on the highest crests, and rings around everything that stands in the water (`foamAround`).
 * Fogged through the shared atmosphere; transparent, drawn after the world (renderOrder 4). One draw call.
 */
import * as THREE from 'three';
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { heightAt, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { WAVES_GLSL, waveClock } from './waves';
import { isStylized } from './stylize';

const SEA_RES = 512; // the sea-floor texture: ~1 m per texel over the chunk

/** an oriented collider box as the player uses them (`player.colliders`) */
interface ColliderBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

export class Ocean {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** sea-surface height (metres) — the still level; waves ride ±0.4 m over it */
  level = 0;
  private uniforms = { uTime: { value: 0 } };
  private seaData!: Uint16Array;
  private seaTex!: THREE.DataTexture;

  constructor(private sky: Sky) {}

  build(): this {
    const def = getActiveChunk().ocean;
    if (!def) throw new Error('Ocean.build(): the active chunk has no `ocean`');
    this.level = def.level;

    // ── grid coordinates: fine over the chunk, coarsening outward to the horizon ──
    const fine = TIER_CONFIG.oceanCell, inner = CHUNK_HALF + 30, far = 4200; // 2.75 m desktop / 4 m phone (57 k → 30 k verts)
    const half: number[] = [];
    for (let v = 0; v <= inner + 1e-6; v += fine) half.push(v);
    let v = half[half.length - 1] ?? 0, step = fine;
    const grow = fine > 3 ? 1.25 : 1.16; // the phone's far ring coarsens faster (13 rings instead of 34 per side)
    while (v < far) { step *= grow; v += step; half.push(v); }
    const coords = [...half.slice(1).reverse().map((c) => -c), ...half];
    const N = coords.length;

    const pos = new Float32Array(N * N * 3), depth = new Float32Array(N * N), seed = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, x = coords[ix] ?? 0, z = coords[iz] ?? 0;
      pos[i * 3] = x; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = z;
      depth[i] = inChunk(x, z) ? def.level - heightAt(x, z) : def.deepDepth * 2;
      seed[i] = hash2(ix, iz);
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) {
      const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1;
      // alternate diagonals so the facets don't all lean one way
      idx[k++] = a; idx[k++] = c;
      if ((ix + iz) & 1) { idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = b; }
      else { idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();

    // ── the sea-floor texture: R = floor height (m), G = obstacle proximity (foamAround fills it) ──
    this.seaData = new Uint16Array(SEA_RES * SEA_RES * 2);
    const h0 = THREE.DataUtils.toHalfFloat(0);
    for (let iz = 0; iz < SEA_RES; iz++) for (let ix = 0; ix < SEA_RES; ix++) {
      const x = -CHUNK_HALF + ((ix + 0.5) / SEA_RES) * CHUNK_SIZE, z = -CHUNK_HALF + ((iz + 0.5) / SEA_RES) * CHUNK_SIZE;
      const i = (iz * SEA_RES + ix) * 2;
      this.seaData[i] = THREE.DataUtils.toHalfFloat(heightAt(x, z)); this.seaData[i + 1] = h0;
    }
    this.seaTex = new THREE.DataTexture(this.seaData, SEA_RES, SEA_RES, THREE.RGFormat, THREE.HalfFloatType);
    this.seaTex.magFilter = this.seaTex.minFilter = THREE.LinearFilter;
    this.seaTex.wrapS = this.seaTex.wrapT = THREE.ClampToEdgeWrapping;
    this.seaTex.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, flatShading: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide,
      transparent: true, premultipliedAlpha: true, depthWrite: true,
    });
    mat.forceSinglePass = true; // a transparent DoubleSide material is otherwise drawn twice (back faces, then front)
    const shallow = new THREE.Vector3(...def.shallowColor), deep = new THREE.Vector3(...def.deepColor);
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, {
        uShallow: { value: shallow }, uDeep: { value: deep }, uDeepDepth: { value: def.deepDepth }, uLevel: { value: def.level },
        tSea: { value: this.seaTex }, uChunkHalf: { value: CHUNK_HALF },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          attribute float depth; attribute float seed;
          uniform float uTime;
          varying float vCrest; varying vec3 vOceanW;
          ${WAVES_GLSL}`)
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed = vec3( position );
          float damp = 0.35 + 0.65 * smoothstep(0.0, 1.5, depth);   // waves.ts seaDamp()
          vec3 g = gerstner(position.xz, uTime, damp);
          transformed += g;
          // a little lateral wobble per vertex keeps the triangles from reading as a regular grid
          transformed.x += sin(uTime * 0.7 + seed * 6.2831) * 0.3;
          transformed.z += cos(uTime * 0.6 + seed * 6.2831 + 1.7) * 0.3;
          vCrest = g.y / max(damp, 0.35); vOceanW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform vec3 uShallow; uniform vec3 uDeep; uniform float uDeepDepth; uniform float uTime; uniform float uLevel;
          uniform sampler2D tSea; uniform float uChunkHalf;
          ${isStylized() ? '' : 'uniform vec3 uFogZenith;'} // the stylized shard's fog chunk declares it (stylize.ts)
          varying float vCrest; varying vec3 vOceanW;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y); }
          float waterA; vec3 waterAdd;`)
        .replace('#include <color_fragment>', /* glsl */`
          {
            // the sea floor under this pixel: height (R) and obstacle proximity (G); deep water off the chunk
            vec2 suv = (vOceanW.xz + uChunkHalf) / (2.0 * uChunkHalf);
            float inC = step(max(abs(suv.x - 0.5), abs(suv.y - 0.5)), 0.5);
            vec2 sea = texture2D(tSea, clamp(suv, 0.0, 1.0)).rg;
            float floorY = mix(uLevel - 40.0, sea.r, inC);
            float still = uLevel - floorY;                          // depth below the still level
            float col = max(vOceanW.y - floorY, 0.0);               // the water column under the wave
            vec3 V = normalize(cameraPosition - vOceanW);
            vec3 fn = normalize(cross(dFdx(vOceanW), dFdy(vOceanW))); fn *= sign(fn.y);
            // Beer–Lambert: opacity from the path through the water (steeper view = clearer)
            float path = col / max(abs(V.y), 0.22);
            float opac = 1.0 - exp(-path * 0.5);
            float t = pow(clamp(still / uDeepDepth, 0.0, 1.0), 1.2);   // the lagoon stays turquoise; blue only where it is really deep
            vec3 water = mix(uShallow, uDeep, t);
            water *= clamp(1.0 + fn.x * 3.4 + fn.z * 2.0, 0.68, 1.38);  // facet grade: every triangle reads
            // ── foam (W2) ──
            float n = vnoise(vOceanW.xz * 0.35 + uTime * 0.12);
            float edge = still + sin(uTime * 1.3 + vOceanW.x * 0.9 + vOceanW.z * 0.4) * 0.1 - vCrest * 0.35;
            float shore = 1.0 - smoothstep(0.1 + n * 0.1, 0.16 + n * 0.1, edge);   // a crisp breaking line
            float lines = smoothstep(0.78, 0.86, fract(still * 1.25 - uTime * 0.28 + n * 0.35)) * (1.0 - smoothstep(0.12, 0.6, still)) * 0.85;   // only over the last half-metre: the lagoon is shallow everywhere
            float ring = smoothstep(0.35, 0.6, sea.g + (n - 0.5) * 0.3) * (0.75 + 0.25 * sin(uTime * 2.4 + sea.g * 9.0));
            float cap = smoothstep(0.24, 0.3, vCrest) * step(0.72, vnoise(vOceanW.xz * 0.22 + 3.1)) * 0.9;
            float foam = clamp(max(max(shore, lines), max(ring * inC, cap)), 0.0, 1.0);
            diffuseColor.rgb = mix(water, vec3(1.0), foam);
            waterA = max(opac, foam);
            // ── reflection + glint, added after lighting ──
            vec3 R = reflect(-V, fn);
            float e = max(R.y, 0.0);
            vec3 skyR = mix(fogColor, uFogZenith, pow(smoothstep(0.0, 0.75, e), 0.62) * 0.6 + 0.4); // biased to the saturated zenith: no white wash
            float fres = 0.02 + 0.98 * pow(1.0 - max(dot(fn, V), 0.0), 5.0);
            float sd = max(dot(R, fogSunDir), 0.0);
            float glint = smoothstep(0.9965, 0.9985, sd) * 5.0 + pow(sd, 90.0) * 0.5;
            waterAdd = (skyR * fres * 0.28 + fogSunColor * glint) * (1.0 - foam) + fogSunColor * foam * 0.5; // foam reads white, not lavender
            waterA = max(waterA, fres * 0.5);
            if (!gl_FrontFacing) { waterA = 0.85; waterAdd = vec3(0.0); } // from below: the surface is a bright ceiling
          }`)
        .replace('#include <opaque_fragment>', /* glsl */`
          {
            float a = clamp(waterA, 0.0, 1.0);
            vec3 premul = outgoingLight * a + waterAdd;
            gl_FragColor = vec4(premul / max(a, 1e-3), a);       // PREMULTIPLIED_ALPHA multiplies it back
          }`);
    };
    mat.customProgramCacheKey = () => 'ocean-v2';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = def.level;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.group.add(this.mesh);
    return this;
  }

  /**
   * Foam rings (W2) around every collider box that pierces the sea surface — pier piles, boulders, hulls, the boat.
   * Stamps a 1.8 m proximity falloff into the sea texture's G channel (once, at build; call again if the set changes).
   */
  foamAround(boxes: readonly ColliderBox[]): void {
    const cell = CHUNK_SIZE / SEA_RES, reach = 1.8, prox = new Float32Array(SEA_RES * SEA_RES);
    for (const b of boxes) {
      if (!(b.yBottom < this.level + 0.3 && b.yTop > this.level - 0.3)) continue;
      const r = Math.hypot(b.hw, b.hd) + reach;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const x0 = Math.floor((b.x - r + CHUNK_HALF) / cell), x1 = Math.ceil((b.x + r + CHUNK_HALF) / cell);
      const z0 = Math.floor((b.z - r + CHUNK_HALF) / cell), z1 = Math.ceil((b.z + r + CHUNK_HALF) / cell);
      for (let iz = Math.max(0, z0); iz <= Math.min(SEA_RES - 1, z1); iz++) for (let ix = Math.max(0, x0); ix <= Math.min(SEA_RES - 1, x1); ix++) {
        const px = -CHUNK_HALF + (ix + 0.5) * cell - b.x, pz = -CHUNK_HALF + (iz + 0.5) * cell - b.z;
        // distance to the oriented box (0 inside)
        const lx = Math.abs(px * c + pz * s) - b.hw, lz = Math.abs(pz * c - px * s) - b.hd; // Player.ts' box frame
        const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
        const p = 1 - d / reach;
        const i = iz * SEA_RES + ix;
        if (p > (prox[i] ?? 0)) prox[i] = p;
      }
    }
    for (let i = 0; i < prox.length; i++) this.seaData[i * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.max(0, prox[i] ?? 0));
    this.seaTex.needsUpdate = true;
  }

  update(dt: number): void { this.uniforms.uTime.value += dt; waveClock.t = this.uniforms.uTime.value; }
}

function hash2(x: number, z: number) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
