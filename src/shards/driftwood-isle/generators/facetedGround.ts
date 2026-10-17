/**
 * Driftwood's faceted ground, baked (SHARD-PLATFORM W2 C2; it was runtime/looks/facetedGround.ts's grid and slab and
 * look/terrainPainter.ts's paint, moved verbatim): the level's heightfield as ONE indexed 256² grid, each vertex painted
 * from its height above the sea, its slope and whether it is a cliff's top lip (look/groundColor.ts), the sand paths over
 * the grass; and the chunk's four slab walls in rock darkening with depth. The bake (bake-faceted-ground.mjs) runs it on
 * the bound native ground and writes two hash-named static GLBs (`facetedGroundGlbs`); the runtime only loads them
 * (runtime/looks/facetedGround.ts).
 */
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '@wildshard/engine/core/config';
import type { PainterField } from '@wildshard/engine/render/look';
import { GROUND_PATHS } from './groundLook';
import { LP, hash2, lowPolyGroundColor } from '../look/groundColor';
import { staticGlb } from '@wildshard/sdk/bake/glb';

/** A faceted ground's numbers as data. */
interface FacetedGroundRow {
  /** the look.materials ids the grid and the slab wear (graph toon materials the look lends before the ground builds) */
  readonly materials: { readonly ground: string; readonly slab: string };
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

/** the field the bake samples: the bound ground's heights, normals and trail distance */
export type FacetedGroundField = Pick<PainterField, 'heightAt' | 'normalAt' | 'trailDistance'>;

/** One grid vertex as the paint reads it: height above the sea (a wall's middle height), slope (1 − normal y), where,
 *  the ground's height and the cliff-lip weight (0‥1). */
interface FacetedGroundCell { h: number; slope: number; x: number; z: number; y: number; lip: number }

const ss = THREE.MathUtils.smoothstep;
const _pathC = new THREE.Color();

/** Driftwood's paint: sand / grass / rock by height and slope, and the sand paths: trails above the beach are sand drawn
 *  over the grass (a 3 m bed with a soft edge). */
function paint(c: THREE.Color, { h, slope, x, z, y, lip }: FacetedGroundCell, f: FacetedGroundField, seaLevel: number): void {
  lowPolyGroundColor(c, h, slope, x, z, lip);
  const p = GROUND_PATHS;
  if (y - seaLevel > p.above) {
    const td = f.trailDistance(x, z);
    if (td < p.to) { _pathC.copy(LP.path).multiplyScalar(p.shade[0] + hash2(x, z) * p.shade[1]); c.lerp(_pathC, 1 - ss(td, p.from, p.to)); }
  }
}

/** The facet colour by height and slope, without paths or lips (the ground under each streamed cover plant,
 *  coverCells.ts). */
export const facetColour = (c: THREE.Color, h: number, slope: number, x: number, z: number): THREE.Color => lowPolyGroundColor(c, h, slope, x, z);

/** The painted grid: positions, Uint8 colours and the index (the last index of a triangle is its provoking vertex). */
export function facetedGrid(f: FacetedGroundField, row: FacetedGroundRow, wl: number): { pos: Float32Array; col: Uint8Array; idx: Uint16Array } {
  const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n, lipRow = row.lip;
  const pos = new Float32Array(res * res * 3), col = new Uint8Array(res * res * 3);
  const c = new THREE.Color();
  const cell: FacetedGroundCell = { h: 0, slope: 0, x: 0, z: 0, y: 0, lip: 0 };
  const hs = new Float32Array(res * res);
  for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = f.heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
  const H = (ix: number, iz: number): number => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
  for (let iz = 0; iz < res; iz++) {
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
      paint(c, cell, f, wl);
      // clamped: a Uint8Array wraps 256+ to ~0
      col[i * 3] = Math.min(255, Math.round(c.r * 255)); col[i * 3 + 1] = Math.min(255, Math.round(c.g * 255)); col[i * 3 + 2] = Math.min(255, Math.round(c.b * 255));
    }
  }
  const idx = new Uint16Array(n * n * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const a = iz * res + ix, b = a + 1, cc = a + res, dd = cc + 1;
    // alternate the diagonal per cell so the facets don't all lean the same way; the last index is the provoking vertex
    idx[k++] = a; idx[k++] = cc;
    if ((ix + iz) & 1) { idx[k++] = dd; idx[k++] = a; idx[k++] = dd; idx[k++] = b; }
    else { idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = dd; }
  }
  return { pos, col, idx };
}

/** The chunk's four slab walls and its bottom, rock darkening with depth, each side jittered by a fixed hash. */
export function facetedSlab(f: FacetedGroundField, row: FacetedGroundRow): { pos: Float32Array; col: Float32Array } {
  const slab = row.slab;
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
  return { pos: Float32Array.from(verts), col: Float32Array.from(cols) };
}

/** The baked ground's two static GLBs: the grid (Uint8 colour, u16 index in the provoking order) and the slab walls. */
export function facetedGroundGlbs(f: FacetedGroundField, row: FacetedGroundRow, seaLevel: number): { ground: Uint8Array; slab: Uint8Array } {
  const grid = facetedGrid(f, row, seaLevel), walls = facetedSlab(f, row), material = new THREE.MeshStandardMaterial();
  const ground = new THREE.BufferGeometry(), slab = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.BufferAttribute(grid.pos, 3)); ground.setAttribute('color', new THREE.BufferAttribute(grid.col, 3, true));
  ground.setIndex(new THREE.BufferAttribute(grid.idx, 1));
  slab.setAttribute('position', new THREE.BufferAttribute(walls.pos, 3)); slab.setAttribute('color', new THREE.BufferAttribute(walls.col, 3));
  try {
    return { ground: staticGlb([{ geometry: ground, material, compactIndex: true }], 'driftwood-ground'), slab: staticGlb([{ geometry: slab, material }], 'driftwood-ground-slab') };
  } finally { ground.dispose(); slab.dispose(); material.dispose(); }
}
