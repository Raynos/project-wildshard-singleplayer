import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '@wildshard/engine/core/config';
import type { PainterField, TerrainPainter } from '@wildshard/engine/render/look';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { Terrain } from '@wildshard/engine/world/Terrain';

/**
 * A faceted, texture-free ground as a terrain painter (SHARD-PLATFORM M3, look-family rows): the level's heightfield as
 * ONE indexed grid with `flatShading` (the normal from screen-space derivatives) and a `flat`-qualified colour varying, so
 * each triangle takes its provoking (last) vertex's colour: solid facets with no per-vertex duplication (the phone is
 * vertex-bound). The grid is built a band of rows per task. Each vertex's colour is the shard's paint, from its height
 * above the sea, its slope and whether it is a cliff's top lip; a facet climbing out of the sea is painted as a wall at
 * its middle height, not as seabed. The chunk's four slab walls are the same idea in rock darkening with depth. Two draw
 * calls, no maps. Nothing here knows a shard: its numbers are a row in its `data/`, its paint and sea level are its own.
 *
 *   look.terrainPainter = facetedGroundPainter(row, OCEAN.level, (c, cell, field) => { …paint c… });
 */

/** A faceted ground's numbers as data. */
export interface FacetedGroundRow {
  /** the material patch's registry id and program cache key */
  readonly patch: { readonly id: string; readonly key: string };
  /** the grid's and the slab's roughness */
  readonly roughness: number;
  readonly slabRoughness: number;
  /** rows built per task */
  readonly band: number;
  /** a cliff's top lip: below this normal y, the highest ground within `reach` m, smoothstepped `from` → `to` m above */
  readonly lip: { readonly steep: number; readonly reach: number; readonly from: number; readonly to: number };
  /** the slab walls: segments per side, rock and deep colours, the lip above the ground (m), the bulge's base and
   *  jittered gain (m), the foot's step out (m), the bulge's depth share and the shade's base and jittered gain */
  readonly slab: {
    readonly segs: number; readonly rock: string; readonly deep: string; readonly top: number;
    readonly bulge: readonly [number, number]; readonly foot: number; readonly mid: number; readonly shade: readonly [number, number];
  };
}

/** One grid vertex as the paint reads it: height above the sea (a wall's middle height), slope (1 − normal y), where,
 *  the ground's height and the cliff-lip weight (0‥1). */
export interface FacetedGroundCell { h: number; slope: number; x: number; z: number; y: number; lip: number }

/** The shard's paint: writes the vertex's colour (linear) into `out`. */
export type FacetedGroundPaint = (out: THREE.Color, cell: FacetedGroundCell, field: PainterField) => void;

const ss = THREE.MathUtils.smoothstep;

/** A terrain painter that builds the faceted ground from its row, sea level and paint. */
export function facetedGroundPainter(row: FacetedGroundRow, seaLevel: number, paint: FacetedGroundPaint): TerrainPainter {
  return { build: (t, f) => buildFacetedGround(t, f, row, seaLevel, paint) };
}

async function buildFacetedGround(t: Terrain, f: PainterField, row: FacetedGroundRow, seaLevel: number, paint: FacetedGroundPaint): Promise<void> {
  await f.ready();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.roughness, metalness: 0 });
  patchShader(mat, row.patch.id, PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    // `flat` interpolation: the whole triangle gets its last vertex's colour. The declaration lives inside the
    // color_pars includes, which are still unexpanded here, so expand them first
    const flat = (chunk: string) => chunk.replace('varying vec4 vColor;', 'flat varying vec4 vColor;');
    shader.vertexShader = shader.vertexShader.replace('#include <color_pars_vertex>', flat(THREE.ShaderChunk.color_pars_vertex));
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_pars_fragment>', flat(THREE.ShaderChunk.color_pars_fragment));
  }, { mode: 'replace', key: row.patch.key });
  t.material = mat;
  const rows = facetedGrid(f, row, seaLevel, paint);
  let r = rows.next();
  while (r.done !== true) { await macrotask(); r = rows.next(); }
  t.mesh = new THREE.Mesh(r.value, mat);
  t.mesh.receiveShadow = true;
  t.mesh.castShadow = true;
  t.group.add(t.mesh);
  t.group.add(facetedSlab(f, row));
}

/** The grid; yields after every band of rows (the caller ends the task there). */
function* facetedGrid(f: PainterField, row: FacetedGroundRow, wl: number, paint: FacetedGroundPaint): Generator<void, THREE.BufferGeometry, undefined> {
  const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n, band = row.band, lipRow = row.lip;
  const pos = new Float32Array(res * res * 3), col = new Uint8Array(res * res * 3);
  const c = new THREE.Color();
  const cell: FacetedGroundCell = { h: 0, slope: 0, x: 0, z: 0, y: 0, lip: 0 };
  const hs = new Float32Array(res * res);
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % band === 0) yield;
    for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = f.heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
  }
  const H = (ix: number, iz: number): number => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % band === 0) yield;
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
      const y = H(ix, iz);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const [, ny] = f.normalAt(x, z, d * 0.5);
      // a cliff's top edge: steep here but nothing much higher within reach, so the top paint lips over it
      let lip = 0;
      if (ny < lipRow.steep) { const r = lipRow.reach, hi = Math.max(f.heightAt(x + r, z), f.heightAt(x - r, z), f.heightAt(x, z + r), f.heightAt(x, z - r)); lip = 1 - ss(hi - y, lipRow.from, lipRow.to); }
      let h = y - wl, slope = 1 - ny;
      if (h < 0) {
        // a facet takes its provoking (last) vertex's colour: this one's facets span it and these neighbours (the index
        // pattern below). One that climbs out of the sea is a wall, not seabed: coloured at its middle height and its slope
        const top = Math.max(H(ix - 1, iz - 1), H(ix, iz - 1), H(ix - 1, iz), H(ix - 1, iz + 1), H(ix, iz + 1)) - wl;
        if (top > 0) { slope = Math.max(slope, 1 - d / Math.hypot(d, top - h)); h = (h + top) * 0.5; }
      }
      cell.h = h; cell.slope = slope; cell.x = x; cell.z = z; cell.y = y; cell.lip = lip;
      paint(c, cell, f);
      // clamped: a Uint8Array wraps 256+ to ~0
      col[i * 3] = Math.min(255, Math.round(c.r * 255)); col[i * 3 + 1] = Math.min(255, Math.round(c.g * 255)); col[i * 3 + 2] = Math.min(255, Math.round(c.b * 255));
    }
  }
  const idx = new Uint32Array(n * n * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const a = iz * res + ix, b = a + 1, cc = a + res, dd = cc + 1;
    // alternate the diagonal per cell so the facets don't all lean the same way; the last index is the provoking vertex
    idx[k++] = a; idx[k++] = cc;
    if ((ix + iz) & 1) { idx[k++] = dd; idx[k++] = a; idx[k++] = dd; idx[k++] = b; }
    else { idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = dd; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** The chunk's four slab walls and its bottom, rock darkening with depth, each side jittered by a fixed hash. */
function facetedSlab(f: PainterField, row: FacetedGroundRow): THREE.Mesh {
  const slab = row.slab;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: row.slabRoughness, metalness: 0 });
  const segs = slab.segs;
  const verts: number[] = [], cols: number[] = [];
  const H = CHUNK_HALF, D = -CHUNK_DEPTH;
  const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
    { a: [-H, -H], b: [H, -H], n: [0, -1] }, { a: [H, -H], b: [H, H], n: [1, 0] }, { a: [H, H], b: [-H, H], n: [0, 1] }, { a: [-H, H], b: [-H, -H], n: [-1, 0] },
  ];
  const rock = new THREE.Color(slab.rock), deep = new THREE.Color(slab.deep);
  const c = new THREE.Color();
  const push = (x: number, y: number, z: number, jit: number) => {
    verts.push(x, y, z);
    c.lerpColors(rock, deep, THREE.MathUtils.clamp(-y / CHUNK_DEPTH, 0, 1)).multiplyScalar(slab.shade[0] + jit * slab.shade[1]);
    cols.push(c.r, c.g, c.b);
  };
  for (const s of sides) {
    const ring: [number, number, number][][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
      const j = (Math.sin(i * 12.9898 + s.n[0] * 3) * 43758.5453) % 1; // deterministic jitter
      const bulge = slab.bulge[0] + Math.abs(j) * slab.bulge[1];
      ring.push([[x, f.heightAt(x, z) + slab.top, z], [x + s.n[0] * bulge, D * slab.mid, z + s.n[1] * bulge], [x + s.n[0] * slab.foot, D, z + s.n[1] * slab.foot]]);
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
      const ri = ring[i], rn = ring[i + 1];
      if (!ri || !rn) continue;
      const a0 = ri[k], a1 = ri[k + 1], b0 = rn[k], b1 = rn[k + 1];
      if (!a0 || !a1 || !b0 || !b1) continue;
      const j = Math.abs((Math.sin(i * 7.31 + k * 3.7) * 1234.5) % 1);
      push(...a0, j); push(...b0, j); push(...a1, j);
      push(...b0, j); push(...b1, j); push(...a1, j);
    }
  }
  // bottom
  push(-H, D, -H, 0); push(H, D, H, 0); push(H, D, -H, 0); push(-H, D, -H, 0); push(-H, D, H, 0); push(H, D, H, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
