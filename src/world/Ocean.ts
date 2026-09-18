/**
 * Ocean — the faceted low-poly sea of an open-water shard (`ChunkDef.ocean`, Driftwood Isle).
 *
 *   const ocean = new Ocean(sky).build();   // reads getActiveChunk().ocean
 *   scene.add(ocean.group);                 // ocean.mesh is the surface
 *   game.onUpdate((dt) => ocean.update(dt));
 *
 * One mesh: a grid 2.75 m fine over the chunk (plus a margin) that coarsens geometrically out to
 * ~4 km, so the same surface runs to the horizon with no seam. The vertices are lifted by three
 * sine waves in the vertex shader; `flatShading` derives the normal per facet from screen-space
 * derivatives, so the facets tilt and glint as the waves roll with no normal recompute on the CPU.
 * Colour is depth-based (a `depth` attribute = sea level − sea floor, from the heightfield) between
 * `shallowColor` and `deepColor`, with a sharp white foam band where the floor breaks the surface
 * and a scattering of white caps on the highest crests. Opaque (no transparency, no reflection
 * pass — the environment map gives the sky tint, the sun gives the sparkle), double-sided so it
 * reads as a ceiling from under water. Fogged through the shared atmosphere. One draw call.
 */
import * as THREE from 'three';
import { CHUNK_HALF } from '../core/config';
import { heightAt, inChunk } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import { getActiveChunk } from '../chunks/registry';
import type { Sky } from './Sky';

export class Ocean {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** sea-surface height (metres) — the still level; waves ride ±0.25 m over it */
  level = 0;
  private uniforms = { uTime: { value: 0 } };

  constructor(private sky: Sky) {}

  build() {
    const def = getActiveChunk().ocean;
    if (!def) throw new Error('Ocean.build(): the active chunk has no `ocean`');
    this.level = def.level;

    // ── grid coordinates: fine over the chunk, coarsening outward to the horizon ──
    const fine = 2.75, inner = CHUNK_HALF + 30, far = 4200;
    const half: number[] = [];
    for (let v = 0; v <= inner + 1e-6; v += fine) half.push(v);
    let v = half[half.length - 1], step = fine;
    while (v < far) { step *= 1.16; v += step; half.push(v); }
    const coords = [...half.slice(1).reverse().map((c) => -c), ...half];
    const N = coords.length;

    const pos = new Float32Array(N * N * 3), depth = new Float32Array(N * N), seed = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, x = coords[ix], z = coords[iz];
      pos[i * 3] = x; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = z;
      depth[i] = inChunk(x, z) ? def.level - heightAt(x, z) : def.deepDepth * 2;
      seed[i] = hash2(ix, iz);
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) {
      const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1;
      // alternate diagonals so the facets don't all lean one way
      if ((ix + iz) & 1) { idx[k++] = a; idx[k++] = c; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = b; }
      else { idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, flatShading: true, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.3, side: THREE.DoubleSide,
    });
    const shallow = new THREE.Vector3(...def.shallowColor), deep = new THREE.Vector3(...def.deepColor);
    mat.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, { uShallow: { value: shallow }, uDeep: { value: deep }, uDeepDepth: { value: def.deepDepth } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', /* glsl */`#include <common>
          attribute float depth; attribute float seed;
          uniform float uTime;
          varying float vDepth; varying float vCrest; varying vec2 vXZ; varying vec3 vOceanW;
          // three low-poly sine waves (metres); the shore damps them so the foam line stays put
          float waveH(vec2 p, float t, float damp) {
            float h = sin(p.x * 0.31 + p.y * 0.17 + t * 1.1) * 0.16
                    + sin(p.x * -0.12 + p.y * 0.42 + t * 0.8) * 0.12
                    + sin(p.x * 0.55 + p.y * -0.35 + t * 1.7) * 0.07;
            return h * damp;
          }`)
        .replace('#include <begin_vertex>', /* glsl */`
          vec3 transformed = vec3( position );
          float damp = mix(0.35, 1.0, smoothstep(0.0, 1.5, depth));
          float h = waveH(position.xz, uTime, damp);
          // a little lateral wobble per vertex keeps the triangles from reading as a regular grid
          transformed.x += sin(uTime * 0.7 + seed * 6.2831) * 0.35;
          transformed.z += cos(uTime * 0.6 + seed * 6.2831 + 1.7) * 0.35;
          transformed.y += h;
          vDepth = depth; vCrest = h; vXZ = position.xz; vOceanW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          uniform vec3 uShallow; uniform vec3 uDeep; uniform float uDeepDepth; uniform float uTime;
          varying float vDepth; varying float vCrest; varying vec2 vXZ; varying vec3 vOceanW;
          float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
        .replace('#include <color_fragment>', /* glsl */`
          {
            float t = sqrt(clamp(vDepth / uDeepDepth, 0.0, 1.0)); // turquoise only over the shallows, blue by mid-depth
            vec3 water = mix(uShallow, uDeep, t);
            // facet shading: the world-space flat normal's lean lightens / darkens each triangle as a block
            vec3 fn = normalize(cross(dFdx(vOceanW), dFdy(vOceanW)));
            fn *= sign(fn.y);
            water *= clamp(1.0 + fn.x * 3.2 + fn.z * 1.8, 0.7, 1.35);
            // shore foam: a hard white band where the floor meets the surface, breathing with the swell
            float edge = vDepth + sin(uTime * 1.3 + vXZ.x * 0.9 + vXZ.y * 0.4) * 0.12;
            float foam = 1.0 - smoothstep(0.16, 0.3, edge);
            foam = max(foam, (1.0 - smoothstep(0.4, 0.5, edge)) * 0.28);
            // white caps on the tallest crests, sparse
            float cap = smoothstep(0.2, 0.25, vCrest) * step(0.9, hash21(floor(vXZ * 0.36))) * 0.8;
            diffuseColor.rgb = mix(water, vec3(0.9), clamp(foam + cap, 0.0, 1.0));
          }`);
    };
    mat.customProgramCacheKey = () => 'ocean-lowpoly';
    this.sky.setupMaterial(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = def.level;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.group.add(this.mesh);
    return this;
  }

  update(dt: number) { this.uniforms.uTime.value += dt; }
}

function hash2(x: number, z: number) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
