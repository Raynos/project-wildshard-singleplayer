/**
 * Ocean v2 — the faceted, stylized sea of an open-water shard (`ShardManifest.ocean`, Driftwood Isle; DRIFTWOOD-REMASTER
 * W1 + W2 + W3).
 *
 *   const ocean = new Ocean(sky).build();   // reads the manifest's OCEAN
 *   scene.add(ocean.group);                 // ocean.mesh is the surface
 *   ocean.foamAround(its registry piece);     // foam rings wherever a collider box pierces the surface (piles, rocks, hulls)
 *   game.onUpdate((dt) => ocean.update(dt));
 *
 * One mesh: a grid 2.75 m fine (phone: 4 m) over the chunk (plus a margin) that coarsens geometrically out to ~4 km.
 * - **waves** (W3): four Gerstner waves from `waves.ts` — the same function the boat / swimmer / debris call in TS —
 *   damped over the sand. E151: the lighting and the grade read the waves' analytic normal per pixel (banded into a few
 *   hard-edged tones), not the grid facet's — the phone's 4 m cells drew as big light / dark triangles (the banded
 *   look is the user's pick; the faceted and unbanded looks went in E162).
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
import { OCEAN } from '../manifest';
import type { DryRect } from './sea';
import { islandKnobs } from '../tiers';
import { toonUniforms } from '../look/toon';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';
import { ownUniforms, PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { inChunk } from '@wildshard/engine/world/Heightfield';
import { HORIZON_RADIUS } from '@wildshard/engine/world/HorizonMatte';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { WAVES_GLSL, WAVES_NORMAL_GLSL, waveClock, waterExtent } from '@wildshard/engine/world/waves';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { OCEAN_GLSL } from '../data/oceanGlsl';

/** the GLSL is data (data/oceanGlsl.ts); `@{name}` splices the fragments this module passes: the engine's wave GLSL, and per sea its dry sockets and edge inset */
const OCEAN_FAMILY = new ShaderFamily({ ...OCEAN_GLSL, WAVES_GLSL, WAVES_NORMAL_GLSL }, {});


const SEA_RES = 512; // the sea-floor texture: ~1 m per texel over the chunk

/** an oriented collider box as the player uses them (`its registry piece`) */
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

  /** `level`: the still level (SF46's lowered world passes road height; default the manifest's OCEAN.level). `dry`: up to
   *  four level-space rectangles the sea is clipped out of (SF46: the entries' 8 × 15 m sockets); none by default.
   *  `edgeInset`: metres inside its confining square (`uWaterHalf`: a grid cell; unbounded standalone) the sea stops (SF46,
   *  G149: the shore revetment's inner face); 0 by default */
  build(level = OCEAN.level, dry: readonly DryRect[] = [], edgeInset = 0): this {
    if (dry.length > 4) throw new RangeError('The ocean clips at most four dry rectangles');
    if (!(edgeInset >= 0)) throw new RangeError('The ocean edge inset is a distance');
    const holes = dry.map((r) => new THREE.Vector4(r.minX, r.minZ, r.maxX, r.maxZ));
    const def = { ...OCEAN, level };
    this.level = def.level;
    toonUniforms.uSeaLevel.value = def.level; // the caustics under it (look/toon.ts, W4)

    // ── grid coordinates: fine over the chunk, coarsening outward to the horizon ──
    const fine = islandKnobs().oceanCell, inner = CHUNK_HALF + 30, far = 4200; // 2.75 m desktop / 4 m phone (57 k → 30 k verts)
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
    // no caustics on the surface itself (stylize.ts). E151: the lighting, the grade, the fresnel and the glint read the
    // waves' analytic normal per pixel, the grade quantised into a few hard-edged bands — the swell draws as stylised
    // contour bands instead of the grid's 4 m (phone) light / dark triangles
    mat.defines = { OCEAN_SURFACE: '' };
    mat.forceSinglePass = true; // a transparent DoubleSide material is otherwise drawn twice (back faces, then front)
    const shallow = new THREE.Vector3(...def.shallowColor), deep = new THREE.Vector3(...def.deepColor);
    patchShader(mat, 'driftwood.ocean', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, {
        uShallow: { value: shallow }, uDeep: { value: deep }, uDeepDepth: { value: def.deepDepth }, uLevel: { value: def.level },
        tSea: { value: this.seaTex }, uChunkHalf: { value: CHUNK_HALF },
        // the sea ends where the painted horizon stands (E125): past it, the far plane cut it on a hard straight line above the
        // matte's islands when seen from altitude
        uSeaEnd: { value: HORIZON_RADIUS },
        uWaterHalf: waterExtent.uWaterHalf, // the level's open-water square (unbounded standalone; its own cell in a grid)
        ...(holes.length === 0 ? {} : { uDry: { value: holes } }),
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', OCEAN_FAMILY.glsl(OCEAN_GLSL.vertexCommon))
        .replace('#include <begin_vertex>', OCEAN_FAMILY.glsl(OCEAN_GLSL.vertexBegin));
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', OCEAN_FAMILY.glsl(OCEAN_GLSL.fragmentCommon, { DRY_UNIFORMS: holes.length === 0 ? '' : ` uniform vec4 uDry[${holes.length}];` }))
        .replace('#include <color_fragment>', OCEAN_FAMILY.glsl(OCEAN_GLSL.fragmentColor))
        .replace('#include <normal_fragment_begin>', OCEAN_FAMILY.glsl(OCEAN_GLSL.fragmentNormal))
        .replace('#include <opaque_fragment>', OCEAN_FAMILY.glsl(OCEAN_GLSL.fragmentOpaque, { EDGE_INSET: edgeInset === 0 ? '' : ` - ${edgeInset.toFixed(3)}`, EDGE_NOTE: edgeInset === 0 ? '' : ' (SF46: to the shore revetment inner face)', DRY_DISCARD: holes.length === 0 ? '' : `
          for (int i = 0; i < ${holes.length}; i++) if (all(greaterThanEqual(vRest, uDry[i].xy)) && all(lessThanEqual(vRest, uDry[i].zw))) discard; // SF46: dry entry sockets` }));
      // the night tint and the ramp fog's zenith are the look's (look/toon.ts declares them in its chunk patches); in a grid
      // region under the neutral page shell those patches are absent, so the sea declares and binds them itself (G226)
      ownUniforms(shader, 'fragment', { uToonNight: { type: 'float', uniform: toonUniforms.uToonNight }, uFogZenith: { type: 'vec3', uniform: toonUniforms.uFogZenith } });
    }, { mode: 'replace', key: 'ocean-v2' });
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
