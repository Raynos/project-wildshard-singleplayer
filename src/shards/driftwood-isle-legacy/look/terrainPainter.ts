/**
 * Driftwood's faceted ground (E357 S4.3 step 3, 08 §6.3 B): the look's `terrainPainter`, built by `Terrain.build` in
 * place of the engine's default ground (it was `Terrain.ts`'s `style === 'toon'` branch, moved verbatim). The sea level
 * for the wet sand and the seabed is the manifest's `OCEAN.level`.
 */
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '@wildshard/engine/core/config';
import type { PainterField, TerrainPainter } from '@wildshard/engine/render/look';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { OCEAN } from '../manifest';
import { LP, hash2, lowPolyGroundColor } from './groundColor';

const _pathC = new THREE.Color();
const ss = THREE.MathUtils.smoothstep;

export const LOWPOLY_TERRAIN: TerrainPainter = { build: buildLowPoly };

/**
 * Driftwood's ground: no textures at all. The same heightfield as an indexed
 * grid with `flatShading` (the normal comes from screen-space derivatives) and a `flat`-qualified
 * colour varying: each triangle takes the colour of its provoking (last) vertex, so the facets are
 * solid blocks of colour with no per-vertex duplication — 65 k vertices for 130 k triangles where a
 * non-indexed mesh needed 390 k (the phone is vertex-bound). Colour is sand / grass / rock by the
 * vertex's height above the sea and its slope, with per-vertex jitter so the facets read. The slab
 * walls are the same idea in dark rock. Two draw calls, no maps.
 */
async function buildLowPoly(t: Terrain, f: PainterField): Promise<void> {
  await f.ready();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  patchShader(mat, 'driftwood.terrain-lowpoly', PATCH_ORDER.material, (shader) => {
    attachFogUniforms(shader);
    // `flat` interpolation: the whole triangle gets its last vertex's colour. The declaration lives inside the
    // color_pars includes, which are still unexpanded here — so expand them first (replacing the bare string never
    // matched, and the ground was smooth-shaded until E43 round 6)
    const flat = (chunk: string) => chunk.replace('varying vec4 vColor;', 'flat varying vec4 vColor;');
    shader.vertexShader = shader.vertexShader.replace('#include <color_pars_vertex>', flat(THREE.ShaderChunk.color_pars_vertex));
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_pars_fragment>', flat(THREE.ShaderChunk.color_pars_fragment));
  }, { mode: 'replace', key: 'terrain-lowpoly' });
  t.material = mat;
  const rows = buildLowPolyGeometry(f);
  let r = rows.next();
  while (r.done !== true) { await macrotask(); r = rows.next(); } // a band of rows per task: the 256² grid was one ~120 ms task at 4x CPU
  t.mesh = new THREE.Mesh(r.value, mat);
  t.mesh.receiveShadow = true;
  t.mesh.castShadow = true; // L6: the cliffs and the plateau shade the beach (+1 draw, ~130 k tris into the shadow map; phone: one 80 m cascade)
  t.group.add(t.mesh);
  t.group.add(buildLowPolySlab(f));
}

/** The low-poly grid; yields after every band of 64 rows (the caller ends the task there). */
function* buildLowPolyGeometry(f: PainterField): Generator<void, THREE.BufferGeometry, undefined> {
  const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
  const pos = new Float32Array(res * res * 3), col = new Uint8Array(res * res * 3);
  const wl = OCEAN.level;
  const c = new THREE.Color();
  const hs = new Float32Array(res * res);
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % 64 === 0) yield;
    for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = f.heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
  }
  const H = (ix: number, iz: number): number => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % 64 === 0) yield;
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
      const y = H(ix, iz);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const [, ny] = f.normalAt(x, z, d * 0.5);
      // a cliff's top edge (L6): steep here but nothing much higher within 2.5 m → the grass lips over it
      let lip = 0;
      if (ny < 0.8) { const hi = Math.max(f.heightAt(x + 2.5, z), f.heightAt(x - 2.5, z), f.heightAt(x, z + 2.5), f.heightAt(x, z - 2.5)); lip = 1 - ss(hi - y, 0.4, 1.4); }
      let h = y - wl, slope = 1 - ny;
      if (h < 0) {
        // a facet takes its provoking (last) vertex's colour — this one's facets span it and these neighbours (the index
        // pattern below). One that climbs out of the sea is a wall, not seabed: coloured at its middle height and its own
        // slope, or the creek's walls went seabed-teal (royal blue in shade) up to a cell above the water (E125)
        const top = Math.max(H(ix - 1, iz - 1), H(ix, iz - 1), H(ix - 1, iz), H(ix - 1, iz + 1), H(ix, iz + 1)) - wl;
        if (top > 0) { slope = Math.max(slope, 1 - d / Math.hypot(d, top - h)); h = (h + top) * 0.5; }
      }
      lowPolyGroundColor(c, h, slope, x, z, lip);
      // the sand paths: trails above the beach are sand drawn over the grass (a 3 m bed with a soft edge)
      if (y - wl > 1.5) { const td = f.trailDistance(x, z); if (td < 4.5) { _pathC.copy(LP.path).multiplyScalar(0.94 + hash2(x, z) * 0.12); c.lerp(_pathC, 1 - ss(td, 2.2, 4.5)); } }
      // clamped: a Uint8Array wraps 256+ to ~0, so a bright sand facet jittered over 1.0 turned mint (r 1.07 → 17)
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

function buildLowPolySlab(f: PainterField): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const segs = 96;
  const verts: number[] = [], cols: number[] = [];
  const H = CHUNK_HALF, D = -CHUNK_DEPTH;
  const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
    { a: [-H, -H], b: [H, -H], n: [0, -1] }, { a: [H, -H], b: [H, H], n: [1, 0] }, { a: [H, H], b: [-H, H], n: [0, 1] }, { a: [-H, H], b: [-H, -H], n: [-1, 0] },
  ];
  const rock = new THREE.Color('#5a5d63'), deep = new THREE.Color('#1c1f26');
  const c = new THREE.Color();
  const push = (x: number, y: number, z: number, jit: number) => {
    verts.push(x, y, z);
    c.lerpColors(rock, deep, THREE.MathUtils.clamp(-y / CHUNK_DEPTH, 0, 1)).multiplyScalar(0.85 + jit * 0.3);
    cols.push(c.r, c.g, c.b);
  };
  for (const s of sides) {
    const ring: [number, number, number][][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
      const j = (Math.sin(i * 12.9898 + s.n[0] * 3) * 43758.5453) % 1; // deterministic jitter
      const bulge = 4 + Math.abs(j) * 5;
      ring.push([[x, f.heightAt(x, z) + 0.05, z], [x + s.n[0] * bulge, D * 0.55, z + s.n[1] * bulge], [x + s.n[0] * 2, D, z + s.n[1] * 2]]);
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
