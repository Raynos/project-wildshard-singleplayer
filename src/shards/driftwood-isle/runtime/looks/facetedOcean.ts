/**
 * A faceted, stylized open sea as a look-family system (SHARD-PLATFORM M3): one mesh over the level's chunk that coarsens
 * out to the horizon, Gerstner waves (the engine's `waves.ts`, the same function the boats and swimmers call), a sea-floor
 * texture baked from the heightfield (per-pixel depth, no depth pre-pass), foam rings round whatever stands in the water.
 * The surface is the shard's sea graph (look.materials, data/oceanLook.ts), handed over with `setOceanLook` before the
 * world builds; this system builds the grid and the sea floor, lends the graph the floor texture and moves its params.
 *
 *   const sea = new FacetedOcean(sky, look, def).build(level, dry, edgeInset);
 *   scene.add(sea.group);               // sea.mesh is the surface
 *   sea.foamAround(boxes);              // foam rings wherever a collider box pierces the surface
 *   game.onUpdate((dt) => sea.update(dt));
 *
 * - **grid**: `cell` metres fine over the chunk (plus 30 m), then each ring ×1.16 wider (×1.25 when the cell is over 3 m)
 *   out to 4.2 km; alternate diagonals so the facets don't all lean one way. Vertex attributes `aDepth` (the still level
 *   less the floor) and `aSeed` (a per-vertex hash).
 * - **sea floor**: a 512² RG half-float texture over the chunk (R = floor height, G = obstacle proximity, `foamAround`),
 *   lent to the graph as `tSea`.
 * - **material**: the sea graph (transparent, double-sided in one pass, toon lit without caustics, fogged by the engine
 *   epilogue); renderOrder 4, never frustum-culled. With no graph handed over the build throws: no procedural stand-in.
 */
import * as THREE from 'three';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';
import { inChunk } from '@wildshard/engine/world/Heightfield';
import { HORIZON_RADIUS } from '@wildshard/engine/world/HorizonMatte';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { waveClock, waterExtent } from '@wildshard/engine/world/waves';
import { OCEAN_DRY_SLOTS, OCEAN_LOOK, OCEAN_NO_DRY } from '../../data/oceanLook';

/** the sea as data: its still level (m), colours (linear albedo) and the depth it is fully deep at (m) */
export interface FacetedOceanDef {
  readonly level: number;
  readonly shallowColor: readonly [number, number, number];
  readonly deepColor: readonly [number, number, number];
  readonly deepDepth: number;
}

/** the light model's uniforms the sea reads: the caustics' sea level (it sets it) and the night tint (its `night`) */
export interface FacetedOceanLight {
  readonly uSeaLevel: { value: number };
  readonly uToonNight: { value: number };
}

/** a shard's sea look: the grid's fine cell and the light it reads */
export interface FacetedOceanLook {
  /** the grid's fine cell (m) */
  readonly cell: number;
  readonly light: FacetedOceanLight;
}

/** a level-space rectangle the sea is clipped out of */
export interface OceanDryRect { readonly minX: number; readonly minZ: number; readonly maxX: number; readonly maxZ: number }

/** an oriented collider box as the player uses them (a registry piece's) */
export interface OceanColliderBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

/** the sea graph as the runtime compiled it, its param and texture writers and its toon look's once-a-frame follow */
interface OceanGraph {
  readonly material: THREE.Material;
  readonly param: (name: string, value: GraphLiteral) => void;
  readonly texture: (name: string, texture: THREE.Texture) => void;
  readonly follow: () => void;
}
let oceanGraph: OceanGraph | null = null;
/** hand the sea its compiled graph (look.materials, data/oceanLook.ts), its writers and its toon look's follow, before
 *  the world builds */
export function setOceanLook(materials: ReadonlyMap<string, THREE.Material>, setParam: (id: string, name: string, value: GraphLiteral) => void,
  setTexture: (id: string, name: string, texture: THREE.Texture) => void, follow: () => void): void {
  const material = materials.get(OCEAN_LOOK);
  if (material === undefined) throw new Error('Driftwood: look.materials lacks the ocean graph');
  oceanGraph = { material, follow, param: (name, value) => { setParam(OCEAN_LOOK, name, value); }, texture: (name, texture) => { setTexture(OCEAN_LOOK, name, texture); } };
}

const SEA_RES = 512; // the sea-floor texture: ~1 m per texel over the chunk

/** A faceted stylized sea from a shard's look and def: build it, ring its standing colliders with foam, step its waves. */
export class FacetedOcean {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  /** sea-surface height (metres) — the still level; waves ride ±0.4 m over it */
  level = 0;
  /** the wave clock (s): the graph's `clock` and `waveClock.t` */
  private time = 0;
  private graph: OceanGraph | null = null;
  private seaData!: Uint16Array;
  private seaTex!: THREE.DataTexture;

  constructor(private readonly look: FacetedOceanLook, private readonly def: FacetedOceanDef) {}

  /** `level`: the still level (default the def's). `dry`: up to four level-space rectangles the sea is clipped out of;
   *  none by default. `edgeInset`: metres inside its confining square (`uWaterHalf`: a grid cell; unbounded standalone)
   *  the sea stops; 0 by default */
  build(level = this.def.level, dry: readonly OceanDryRect[] = [], edgeInset = 0): this {
    if (dry.length > OCEAN_DRY_SLOTS) throw new RangeError('The ocean clips at most four dry rectangles');
    if (!(edgeInset >= 0)) throw new RangeError('The ocean edge inset is a distance');
    const graph = oceanGraph;
    if (graph === null) throw new Error('Driftwood: the ocean draws only with its look.materials graph (setOceanLook)');
    this.graph = graph;
    const def = { ...this.def, level }, look = this.look;
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
    geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
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

    // the graph's params: the sea's own numbers, the chunk, the painted horizon, the inset and the dry sockets
    graph.param('level', def.level); graph.param('deepDepth', def.deepDepth);
    graph.param('shallow', [...def.shallowColor]); graph.param('deep', [...def.deepColor]);
    graph.param('chunkHalf', CHUNK_HALF);
    // the sea ends where the painted horizon stands: past it, the far plane cut it on a hard straight line above the
    // matte's islands when seen from altitude
    graph.param('seaEnd', HORIZON_RADIUS);
    graph.param('edgeInset', edgeInset); // SF46: to the shore revetment inner face
    for (const i of [0, 1, 2, 3]) { // SF46: the dry entry sockets (OCEAN_DRY_SLOTS)
      const r = dry[i];
      graph.param(`dry${String(i)}`, r === undefined ? [...OCEAN_NO_DRY] : [r.minX, r.minZ, r.maxX, r.maxZ]);
    }
    graph.texture('tSea', this.seaTex);
    this.step();
    this.mesh = new THREE.Mesh(geo, graph.material);
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

  update(dt: number): void { this.time += dt; waveClock.t = this.time; this.step(); }

  /** the graph's live params: the wave clock, the level's open-water square (live: a grid cell's own), the night tint;
   *  and its toon look following the day clock */
  private step(): void {
    const graph = this.graph;
    if (graph === null) return;
    graph.param('clock', this.time); graph.param('waterHalf', waterExtent.uWaterHalf.value); graph.param('night', this.look.light.uToonNight.value);
    graph.follow();
  }
}

function hash2(x: number, z: number) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
