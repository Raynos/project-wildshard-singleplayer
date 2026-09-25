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
 *   damped over the sand. E151: the lighting and the grade read the waves' analytic normal per pixel (banded into a few
 *   hard-edged tones), not the grid facet's — the phone's 4 m cells drew as big light / dark triangles (`seaLook()`,
 *   `?sea=v1` = the faceted look).
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
import { WAVES_GLSL, WAVES_NORMAL_GLSL, waveClock } from './waves';
import { toonUniforms } from './stylize';
import { HORIZON_RADIUS } from './HorizonMatte';

const SEA_RES = 512; // the sea-floor texture: ~1 m per texel over the chunk

/**
 * The sea's look (E151; the taste rule: the old look stays one flag away):
 *   (default)   smooth waves: the lighting, the facet grade, the fresnel and the glint read the waves' analytic normal per
 *               pixel, and the grade is quantised into a few hard-edged bands, so the swell draws as stylised contour
 *               bands instead of the grid's 4 m (phone) light / dark triangles
 *   ?sea=soft   the same smooth normal, the grade unbanded (a plain smooth gradient)
 *   ?sea=v1     the faceted sea before E151: every grid triangle flat-shaded and graded on its own
 */
export type SeaLook = 'banded' | 'soft' | 'v1';
export function seaLook(): SeaLook {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('sea');
  return q === 'v1' || q === 'soft' ? q : 'banded';
}

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
    toonUniforms.uSeaLevel.value = def.level; // the caustics under it (stylize.ts, W4)

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
    const look = seaLook();
    // no caustics on the surface itself (stylize.ts); SEA_FACETED = the pre-E151 per-facet look, SEA_BANDED = the banded grade
    mat.defines = { OCEAN_SURFACE: '', ...(look === 'v1' ? { SEA_FACETED: '' } : look === 'banded' ? { SEA_BANDED: '' } : {}) };
    mat.forceSinglePass = true; // a transparent DoubleSide material is otherwise drawn twice (back faces, then front)
    const shallow = new THREE.Vector3(...def.shallowColor), deep = new THREE.Vector3(...def.deepColor);
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, {
        uShallow: { value: shallow }, uDeep: { value: deep }, uDeepDepth: { value: def.deepDepth }, uLevel: { value: def.level },
        tSea: { value: this.seaTex }, uChunkHalf: { value: CHUNK_HALF },
        // the sea ends where the painted horizon stands (E125): past it, the far plane cut it on a hard straight line above the
        // matte's islands when seen from altitude
        uSeaEnd: { value: HORIZON_RADIUS },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          attribute float depth; attribute float seed;
          uniform float uTime;
          varying float vCrest; varying vec3 vOceanW; varying vec2 vRest; varying float vDamp;
          ${WAVES_GLSL}`)
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed = vec3( position );
          float damp = 0.35 + 0.65 * smoothstep(0.0, 1.5, depth);   // waves.ts seaDamp()
          vec3 g = gerstner(position.xz, uTime, damp);
          transformed += g;
          // a little lateral wobble per vertex keeps the triangles from reading as a regular grid
          transformed.x += sin(uTime * 0.7 + seed * 6.2831) * 0.3;
          transformed.z += cos(uTime * 0.6 + seed * 6.2831 + 1.7) * 0.3;
          vCrest = g.y / max(damp, 0.35); vOceanW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vRest = (modelMatrix * vec4(position, 1.0)).xz; vDamp = damp;   // E151: the rest point the fragment's normal is taken at`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform vec3 uShallow; uniform vec3 uDeep; uniform float uDeepDepth; uniform float uTime; uniform float uLevel;
          uniform sampler2D tSea; uniform float uChunkHalf; uniform float uSeaEnd;
          varying float vCrest; varying vec3 vOceanW; varying vec2 vRest; varying float vDamp;
          ${WAVES_NORMAL_GLSL}
          vec3 seaN;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y); }
          float waterA; vec3 waterAdd;`)
        .replace('#include <color_fragment>', /* glsl */`
          {
            // the sea floor under this pixel: height (R) and obstacle proximity (G). Off the chunk the edge's floor carries on and
            // sinks smoothly over 260 m — no straight-edged dark wedge along the chunk border
            vec2 suv = (vOceanW.xz + uChunkHalf) / (2.0 * uChunkHalf);
            float outD = length(max(abs(vOceanW.xz) - uChunkHalf, 0.0));
            float inC = step(outD, 0.0);
            vec2 cuv = clamp(suv, 0.001, 0.999);
            vec2 sea = texture2D(tSea, cuv).rg;
            float floorY = mix(sea.r, uLevel - 30.0, smoothstep(0.0, 260.0, outD));
            float still = uLevel - floorY;                          // depth below the still level
            float col = max(vOceanW.y - floorY, 0.0);               // the water column under the wave
            // metres to the water line: the depth over the local floor slope (two more fetches one texel over)
            float tx = 2.0 * uChunkHalf / 512.0;
            float hx = texture2D(tSea, cuv + vec2(1.0 / 512.0, 0.0)).r, hz = texture2D(tSea, cuv + vec2(0.0, 1.0 / 512.0)).r;
            float slope = length(vec2(hx - sea.r, hz - sea.r)) / tx;
            float shoreD = still / max(slope, 0.012);
            vec3 V = normalize(cameraPosition - vOceanW);
            #ifdef SEA_FACETED
            vec3 fn = normalize(cross(dFdx(vOceanW), dFdy(vOceanW))); fn *= sign(fn.y);
            #else
            // E151: the waves' own normal at this pixel's rest point, not the grid facet's — no 4 m light / dark triangles
            vec3 fn = gerstnerNormal(vRest, uTime, vDamp);
            #endif
            seaN = fn;
            // Beer–Lambert: opacity from the path through the water (steeper view = clearer)
            float path = col / max(abs(V.y), 0.22);
            float opac = 1.0 - exp(-path * 0.85);
            float t = smoothstep(0.0, 1.0, pow(clamp(still / uDeepDepth, 0.0, 1.0), 0.9));   // turquoise lagoon → cobalt, one smooth ramp
            vec3 water = mix(uShallow, uDeep, t);
            #ifdef SEA_FACETED
            water *= clamp(1.0 + fn.x * 4.2 + fn.z * 2.6, 0.58, 1.48);  // facet grade: every triangle reads
            #else
            // the swell's grade from the smooth normal; banded, it steps in a few hard-edged tones (the toon look in colour,
            // not in the grid's triangles), 10 % a step. The smooth normal tilts far less than a 4 m facet did, so the grade is
            // 2.6× the old one (picked from 1.0 / 1.4 / 1.8 / 2.6 on the phone). fwidth keeps each step's edge one pixel wide
            float gr = (fn.x * 4.2 + fn.z * 2.6) * 2.6 / 0.1;
            #ifdef SEA_BANDED
            float gw = clamp(fwidth(gr), 0.02, 0.5);
            gr = floor(gr) + smoothstep(0.5 - gw, 0.5 + gw, fract(gr));
            #endif
            water *= clamp(1.0 + gr * 0.1, 0.58, 1.48);
            #endif
            water = mix(water, water * vec3(0.12, 0.3, 0.75), uToonNight);   // a moonlit sea is deep teal-blue, not lagoon cyan
            // ── foam (W2): 2–3 thin broken lace lines along the shore, rings round what stands in the water, caps out deep ──
            float n = vnoise(vOceanW.xz * 0.55 + uTime * 0.15);
            float d0 = shoreD + sin(uTime * 1.1 + dot(vOceanW.xz, vec2(0.07, 0.05))) * 0.3 - vCrest * 0.8;   // the line breathes with the swell
            float l1 = smoothstep(-0.05, 0.05, d0) * (1.0 - smoothstep(0.22, 0.36, d0)) * step(0.34, vnoise(vOceanW.xz * 1.7 + vec2(uTime * 0.3, 0.0)));   // a thin broken lace, not a ribbon
            float ph = fract(uTime * 0.16 + n * 0.15);
            float p2 = mix(3.0, 0.9, ph);
            float l2 = (1.0 - smoothstep(0.1, 0.28, abs(d0 - p2))) * step(0.42, vnoise(vOceanW.xz * 0.9 + 7.0)) * (1.0 - ph * 0.6);
            float p3 = mix(5.0, 2.2, fract(ph + 0.5));
            float l3 = (1.0 - smoothstep(0.08, 0.22, abs(d0 - p3))) * step(0.55, vnoise(vOceanW.xz * 0.7 + 13.0)) * 0.8;
            float lace = max(l1, max(l2, l3)) * inC * (1.0 - smoothstep(6.0, 9.0, shoreD)) * step(0.0, still);   // never where a crest pokes over the sand
            // rings round what stands in the water (E125): a broken lace collar hugging it + a thin ripple walking outward.
            // G is a ~1 m-texel proximity field, so any iso-line of it is the texel polygon (it drew as solid white hexagons):
            // turn it back into metres, wobble that by noise wider than a texel, and draw only thin broken bands of it
            float od = (1.0 - sea.g) * 3.0 + (n - 0.5) * 0.5 + (vnoise(vOceanW.xz * 1.3 - uTime * 0.2) - 0.5) * 0.35;
            float rn = vnoise(vOceanW.xz * 2.4 + vec2(uTime * 0.35, -uTime * 0.25));
            float r1 = (1.0 - smoothstep(0.22, 0.3, od - vCrest * 0.4)) * step(0.42, rn);
            float rp = fract(uTime * 0.3 + n * 0.25);
            float r2 = (1.0 - smoothstep(0.05, 0.14, abs(od - mix(0.45, 1.9, rp)))) * step(0.5, rn) * (1.0 - rp) * 0.9;
            float ring = max(r1, r2) * smoothstep(0.0, 0.12, sea.g) * inC;
            float cap = smoothstep(0.2, 0.26, vCrest) * step(0.62, vnoise(vOceanW.xz * 0.2 + 3.1)) * smoothstep(2.5, 8.0, still) * 0.85;
            float foam = clamp(max(max(lace, ring), cap), 0.0, 1.0);
            diffuseColor.rgb = mix(water, vec3(1.0), foam);
            waterA = max(opac, foam);
            // ── reflection + glint, added after lighting ──
            vec3 R = reflect(-V, fn);
            float e = max(R.y, 0.0);
            vec3 skyR = mix(fogColor, uFogZenith, pow(smoothstep(0.0, 0.75, e), 0.62) * 0.6 + 0.4); // biased to the saturated zenith: no white wash
            float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(fn, V), 0.0, 1.0), 5.0);
            float sd = max(dot(R, fogSunDir), 0.0);
            // glints break up facet by facet into sparkles (a flat patch facing the sun would be one blinding blob)
            float sparkle = step(0.92, hash21(floor(vOceanW.xz * 1.3) + floor(uTime * 3.0)));
            float glint = smoothstep(0.994, 0.998, sd) * 1.0 * sparkle + pow(sd, 60.0) * 0.08;
            waterAdd = (skyR * fres * 0.14 + fogSunColor * glint) * (1.0 - foam) + fogSunColor * foam * 0.5; // foam reads white, not lavender
            waterA = max(waterA, fres * 0.3);
            if (!gl_FrontFacing) {
              // from below (W4): Snell's window — inside ~49° of straight up the sky shows through, bright; outside it the
              // surface is a mirror of the deep water (total internal reflection)
              float up = abs(dot(fn, V));
              float win = smoothstep(0.6, 0.7, up);
              vec3 skyU = mix(fogColor, uFogZenith, 0.5) * 1.4;
              waterA = 1.0;
              waterAdd = mix(uDeep * 1.6 + uShallow * 0.15, skyU, win);
              diffuseColor.rgb = vec3(0.0);
            }
          }`)
        .replace('#include <normal_fragment_begin>', /* glsl */`#include <normal_fragment_begin>
          #ifndef SEA_FACETED
          normal = normalize((viewMatrix * vec4(seaN * faceDirection, 0.0)).xyz);   // E151: the toon lighting reads the smooth wave too
          nonPerturbedNormal = normal;
          #endif`)
        .replace('#include <opaque_fragment>', /* glsl */`
          {
            // fade out over the last 300 m before the painted horizon, so the islands' feet stand on the sea's own far edge
            float seaEnd = 1.0 - smoothstep(uSeaEnd - 300.0, uSeaEnd, length(vOceanW.xz - cameraPosition.xz));
            float a = clamp(waterA, 0.0, 1.0) * seaEnd;
            vec3 premul = outgoingLight * a + waterAdd * seaEnd;
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
   * Stamps a 3 m proximity falloff (the shader reads (1 − G) × 3 back as metres) into the sea texture's G channel (once, at build; call again if the set changes).
   */
  foamAround(boxes: readonly ColliderBox[]): void {
    const cell = CHUNK_SIZE / SEA_RES, reach = 3.0, prox = new Float32Array(SEA_RES * SEA_RES);
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
