/**
 * A faceted, stylized open sea as a look-family system (SHARD-PLATFORM M3): one mesh over the level's chunk that coarsens
 * out to the horizon, Gerstner waves (the engine's `waves.ts`, the same function the boats and swimmers call), a sea-floor
 * texture baked from the heightfield (per-pixel depth, no depth pre-pass), foam rings round whatever stands in the water.
 * Nothing here knows a shard: the shard passes its GLSL rows (spliced with the shared `ShaderFamily`: `@{WAVES_GLSL}` /
 * `@{WAVES_NORMAL_GLSL}` and, per sea, `@{DRY_UNIFORMS}`, `@{EDGE_INSET}`, `@{EDGE_NOTE}`, `@{DRY_DISCARD}`, which this
 * system passes), its colours and depth, the grid's fine cell, its patch id and the light model's uniforms it reads.
 *
 *   const sea = new FacetedOcean(sky, look, def).build(level, dry, edgeInset);
 *   scene.add(sea.group);               // sea.mesh is the surface
 *   sea.foamAround(boxes);              // foam rings wherever a collider box pierces the surface
 *   game.onUpdate((dt) => sea.update(dt));
 *
 * - **grid**: `cell` metres fine over the chunk (plus 30 m), then each ring ×1.16 wider (×1.25 when the cell is over 3 m)
 *   out to 4.2 km; alternate diagonals so the facets don't all lean one way. Vertex attributes `depth` (the still level
 *   less the floor) and `seed` (a per-vertex hash).
 * - **sea floor**: a 512² RG half-float texture over the chunk (R = floor height, G = obstacle proximity, `foamAround`).
 * - **material**: a transparent, premultiplied, double-sided single-pass MeshStandard (flat shading, `OCEAN_SURFACE`
 *   defined), patched by the shard's rows; fogged through the shared atmosphere; renderOrder 4, never frustum-culled.
 */
import * as THREE from 'three';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';
import { ownUniforms, PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { inChunk } from '@wildshard/engine/world/Heightfield';
import { HORIZON_RADIUS } from '@wildshard/engine/world/HorizonMatte';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { WAVES_GLSL, WAVES_NORMAL_GLSL, waveClock, waterExtent } from '@wildshard/engine/world/waves';
import { ShaderFamily } from './shaderFamily';

/** the sea's GLSL rows: each replaces one of three's MeshStandard chunks */
export interface FacetedOceanGlsl {
  readonly vertexCommon: string;
  readonly vertexBegin: string;
  readonly fragmentCommon: string;
  readonly fragmentColor: string;
  readonly fragmentNormal: string;
  readonly fragmentOpaque: string;
}

/** the sea as data: its still level (m), colours (linear albedo) and the depth it is fully deep at (m) */
export interface FacetedOceanDef {
  readonly level: number;
  readonly shallowColor: readonly [number, number, number];
  readonly deepColor: readonly [number, number, number];
  readonly deepDepth: number;
}

/** the light model's uniforms the sea reads (and declares itself where the look's chunk patches are absent) */
export interface FacetedOceanLight {
  readonly uSeaLevel: { value: number };
  readonly uToonNight: { value: number };
  readonly uFogZenith: { value: THREE.Color };
}

/** a shard's sea look: its rows, its patch id and key, the grid's fine cell and the light it reads */
export interface FacetedOceanLook {
  readonly glsl: FacetedOceanGlsl;
  /** the material patch's id and cache key */
  readonly patchId: string;
  readonly patchKey: string;
  /** the grid's fine cell (m) */
  readonly cell: number;
  readonly light: FacetedOceanLight;
}

/** a level-space rectangle the sea is clipped out of */
export interface OceanDryRect { readonly minX: number; readonly minZ: number; readonly maxX: number; readonly maxZ: number }

/** an oriented collider box as the player uses them (a registry piece's) */
export interface OceanColliderBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const SEA_RES = 512; // the sea-floor texture: ~1 m per texel over the chunk

export class FacetedOcean {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** sea-surface height (metres) — the still level; waves ride ±0.4 m over it */
  level = 0;
  private uniforms = { uTime: { value: 0 } };
  private seaData!: Uint16Array;
  private seaTex!: THREE.DataTexture;
  private readonly family: ShaderFamily;

  constructor(private readonly sky: SkyRig, private readonly look: FacetedOceanLook, private readonly def: FacetedOceanDef) {
    this.family = new ShaderFamily({ ...look.glsl, WAVES_GLSL, WAVES_NORMAL_GLSL }, {});
  }

  /** `level`: the still level (default the def's). `dry`: up to four level-space rectangles the sea is clipped out of;
   *  none by default. `edgeInset`: metres inside its confining square (`uWaterHalf`: a grid cell; unbounded standalone)
   *  the sea stops; 0 by default */
  build(level = this.def.level, dry: readonly OceanDryRect[] = [], edgeInset = 0): this {
    if (dry.length > 4) throw new RangeError('The ocean clips at most four dry rectangles');
    if (!(edgeInset >= 0)) throw new RangeError('The ocean edge inset is a distance');
    const holes = dry.map((r) => new THREE.Vector4(r.minX, r.minZ, r.maxX, r.maxZ));
    const def = { ...this.def, level }, look = this.look, family = this.family, glsl = look.glsl;
    this.level = def.level;
    look.light.uSeaLevel.value = def.level; // the caustics under it

    // ── grid coordinates: fine over the chunk, coarsening outward to the horizon ──
    const fine = look.cell, inner = CHUNK_HALF + 30, far = 4200;
    const half: number[] = [];
    for (let v = 0; v <= inner + 1e-6; v += fine) half.push(v);
    let v = half[half.length - 1] ?? 0, step = fine;
    const grow = fine > 3 ? 1.25 : 1.16; // a coarse cell's far ring coarsens faster
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
    mat.defines = { OCEAN_SURFACE: '' };
    mat.forceSinglePass = true; // a transparent DoubleSide material is otherwise drawn twice (back faces, then front)
    const shallow = new THREE.Vector3(...def.shallowColor), deep = new THREE.Vector3(...def.deepColor);
    patchShader(mat, look.patchId, PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.uniforms, {
        uShallow: { value: shallow }, uDeep: { value: deep }, uDeepDepth: { value: def.deepDepth }, uLevel: { value: def.level },
        tSea: { value: this.seaTex }, uChunkHalf: { value: CHUNK_HALF },
        // the sea ends where the painted horizon stands: past it, the far plane cut it on a hard straight line above the
        // matte's islands when seen from altitude
        uSeaEnd: { value: HORIZON_RADIUS },
        uWaterHalf: waterExtent.uWaterHalf, // the level's open-water square (unbounded standalone; its own cell in a grid)
        ...(holes.length === 0 ? {} : { uDry: { value: holes } }),
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', family.glsl(glsl.vertexCommon))
        .replace('#include <begin_vertex>', family.glsl(glsl.vertexBegin));
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', family.glsl(glsl.fragmentCommon, { DRY_UNIFORMS: holes.length === 0 ? '' : ` uniform vec4 uDry[${holes.length}];` }))
        .replace('#include <color_fragment>', family.glsl(glsl.fragmentColor))
        .replace('#include <normal_fragment_begin>', family.glsl(glsl.fragmentNormal))
        .replace('#include <opaque_fragment>', family.glsl(glsl.fragmentOpaque, { EDGE_INSET: edgeInset === 0 ? '' : ` - ${edgeInset.toFixed(3)}`, EDGE_NOTE: edgeInset === 0 ? '' : ' (SF46: to the shore revetment inner face)', DRY_DISCARD: holes.length === 0 ? '' : `
          for (int i = 0; i < ${holes.length}; i++) if (all(greaterThanEqual(vRest, uDry[i].xy)) && all(lessThanEqual(vRest, uDry[i].zw))) discard; // SF46: dry entry sockets` }));
      // the night tint and the ramp fog's zenith are the light model's (its chunk patches declare them); in a grid region
      // under the neutral page shell those patches are absent, so the sea declares and binds them itself (G226)
      ownUniforms(shader, 'fragment', { uToonNight: { type: 'float', uniform: look.light.uToonNight }, uFogZenith: { type: 'vec3', uniform: look.light.uFogZenith } });
    }, { mode: 'replace', key: look.patchKey });
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
   * Foam rings around every collider box that pierces the sea surface (piles, boulders, hulls, boats).
   * Stamps a 3 m proximity falloff (the shader reads (1 − G) × 3 back as metres) into the sea texture's G channel (once, at
   * build; call again if the set changes).
   */
  foamAround(boxes: readonly OceanColliderBox[]): void {
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
        const lx = Math.abs(px * c + pz * s) - b.hw, lz = Math.abs(pz * c - px * s) - b.hd; // the player's box frame
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
