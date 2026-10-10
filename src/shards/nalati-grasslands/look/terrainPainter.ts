/**
 * Nalati's painted terrain (E357 S3.2, 07 §6.2 step 3): the look's `terrainPainter`, built by `Terrain.build` in place
 * of the engine's default ground (it was `Terrain.ts`'s `style === 'painterly'` branch, moved verbatim).
 */
import * as THREE from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { CHUNK_SIZE, CHUNK_HALF, CHUNK_DEPTH, TERRAIN_RES } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import type { PainterField, TerrainPainter } from '@wildshard/engine/render/look';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { NALATI_GRASSLANDS as def } from '../manifest';
import { applyTerrainSurface } from '../terrainSurface';
import { zoneWeights } from './zones';
import { loadNalatiTextures } from './nalatiTextures';

/** the manifest's terrain field (what `terrainFor(def)` returned) */
function terrain(): NonNullable<typeof def.ground.terrain> {
  const t = def.ground.terrain;
  if (!t) throw new Error('No terrain for nalati-grasslands');
  return t;
}

export const NALATI_TERRAIN_PAINTER: TerrainPainter = { build: buildPainterly };

/**
 * `style: 'painterly'` (Nalati): no textures. A smooth indexed grid (normals from the height grid), each vertex
 * painted by the def's `groundColor(x, z, h, slope)` — the valley / plateau greens, gravel, rock, snow — on the
 * shared painterly material with soft cel bands (terrain takes a gentler ramp than props, so the slopes still
 * read as gradients). The slab walls are painted rock on the same material. Two draw calls, one program.
 */
async function buildPainterly(t: Terrain, f: PainterField): Promise<void> {
  const [, tex] = await Promise.all([f.ready(), loadNalatiTextures(['meadow', 'path', 'gravel', 'rock', 'snow'])]);
  const mat = painterlyMaterial(null, { bands: 0.5, rim: 0, shade: 0.85 }); // bootstrap passes it through sky.setupMaterial
  applyTerrainSurface(mat, tex); // the painted ground: meadow, dirt track, gravel, granite, snow (src/shards/nalati-grasslands/terrainSurface.ts)
  t.material = mat;
  const rows = buildPainterlyGeometry(f);
  let r = rows.next();
  while (r.done !== true) { await macrotask(); r = rows.next(); }
  t.mesh = new THREE.Mesh(r.value, mat);
  t.mesh.receiveShadow = true;
  t.mesh.castShadow = false;
  t.group.add(t.mesh);
  const slab = new THREE.Mesh(buildPainterlySlab(f), mat); // the same material: painted granite walls, a grassy lip
  slab.receiveShadow = true;
  t.group.add(slab);
}

/** the painted terrain grid (G227: public so a bake runs the one painter on its native samplers; no behaviour change) */
export function* buildPainterlyGeometry(f: PainterField): Generator<void, THREE.BufferGeometry, undefined> {
  const paint = def.groundColor;
  const res = TERRAIN_RES, n = res - 1, d = CHUNK_SIZE / n;
  const hs = new Float32Array(res * res);
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % 32 === 0) yield; // SF67: 64 rows of heights were ~100 ms at 4x CPU
    for (let ix = 0; ix < res; ix++) hs[iz * res + ix] = f.heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
  }
  yield;
  const H = (ix: number, iz: number) => hs[Math.min(n, Math.max(0, iz)) * res + Math.min(n, Math.max(0, ix))] ?? 0;
  const pos = new Float32Array(res * res * 3), nrm = new Float32Array(res * res * 3), col = new Float32Array(res * res * 3);
  const surf = new Float32Array(res * res * 4), rdir = new Float32Array(res * res * 2);
  const zone = new Float32Array(res * res * 3), zw: [number, number, number] = [0, 0, 0]; // layout v2's zones (src/shards/nalati-grasslands/look/zones.ts)
  const road: [number, number, number] = [0, 0, 0];
  const out: [number, number, number] = [0, 0, 0];
  const segs = trailSegments(f);
  for (let iz = 0; iz < res; iz++) {
    if (iz > 0 && iz % 24 === 0) yield; // SF67: 48 rows a task were 95-130 ms at 4x CPU
    for (let ix = 0; ix < res; ix++) {
      const i = iz * res + ix, x = -CHUNK_HALF + ix * d, z = -CHUNK_HALF + iz * d;
      const y = H(ix, iz);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const nx = H(ix - 1, iz) - H(ix + 1, iz), nz = H(ix, iz - 1) - H(ix, iz + 1), ny = 2 * d;
      const l = Math.hypot(nx, ny, nz);
      nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l;
      const slope = 1 - ny / l;
      paint?.(x, z, y, slope, terrain(), out); // the manifest always paints (groundColor)
      col[i * 3] = out[0]; col[i * 3 + 1] = out[1]; col[i * 3 + 2] = out[2];
      // the surface-detail masks (src/shards/nalati-grasslands/terrainSurface.ts): road across · gravel · snow · rock
      const [gravel = 0, rock = 0, snow = 0] = def.surfaceAt?.(x, z, y, slope) ?? [];
      signedTrailDistance(segs, x, z, 9, road); rdir[i * 2] = road[1]; rdir[i * 2 + 1] = road[2];
      surf[i * 4] = road[0]; surf[i * 4 + 1] = gravel; surf[i * 4 + 2] = snow; surf[i * 4 + 3] = rock;
      zoneWeights(x, z, y, slope, zw); zone[i * 3] = zw[0]; zone[i * 3 + 1] = zw[1]; zone[i * 3 + 2] = zw[2];
    }
  }
  const idx = new Uint32Array(n * n * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const a = iz * res + ix, b = a + 1, c = a + res, e = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = e;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
  geo.setAttribute('rdir', new THREE.BufferAttribute(rdir, 2));
  geo.setAttribute('zone', new THREE.BufferAttribute(zone, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * The painterly slab: the floating shard's rim as the mockups paint it — a grassy lip that overhangs a little, then
 * weathered granite (the terrain material's painted rock, triplanar) bulging and breaking in noisy ledges down to the
 * slab's floor, darker with depth. The rows step outward / inward by a seeded noise, so from above the edge reads as
 * a ragged rocky cliff, not a ruled line. Same material as the ground (one program), masks in `surf` (rock = 1 below
 * the lip). Indexed, smooth normals.
 */
function buildPainterlySlab(f: PainterField): THREE.BufferGeometry {
  const segs = 256;
  const H = CHUNK_HALF, D = -CHUNK_DEPTH;
  const n = new Noise2D(def.seed + 404);
  // rows down the wall: [metres below the lip (negative = depth fraction of the slab), outward bulge scale, rock 0/1]
  const ROWS: [number, number, number][] = [[0, 0, 0], [0.6, 1.2, 0], [1.6, 1.6, 1], [4, 0.6, 1], [8, 2.2, 1], [14, 1.0, 1], [22, 2.8, 1], [34, 1.4, 1], [-0.55, 3.5, 1], [-1, 0.5, 1]];
  const verts: number[] = [], cols: number[] = [], surf: number[] = [], rdir: number[] = [], idx: number[] = [];
  const sides: { a: [number, number]; b: [number, number]; n: [number, number] }[] = [
    { a: [-H, -H], b: [H, -H], n: [0, -1] }, { a: [H, -H], b: [H, H], n: [1, 0] }, { a: [H, H], b: [-H, H], n: [0, 1] }, { a: [-H, H], b: [-H, -H], n: [-1, 0] },
  ];
  const grass: [number, number, number] = [0, 0, 0];
  const rockTop = new THREE.Color(0.46, 0.41, 0.35), rockMid = new THREE.Color(0.3, 0.27, 0.25), deep = new THREE.Color(0.1, 0.1, 0.12);
  const c = new THREE.Color();
  for (const s of sides) {
    const base = verts.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
      const y0 = f.heightAt(x, z) + 0.05;
      const u = (s.n[0] !== 0 ? z : x) * 0.02 + s.n[0] * 3.1 + s.n[1] * 7.3;
      const [, ny] = f.normalAt(x, z, 1.5);
      def.groundColor?.(x, z, y0, 1 - ny, terrain(), grass);
      for (const [r, [dy, bulge, rock]] of ROWS.entries()) {
        const y = dy >= 0 ? y0 - dy : D * -dy;
        // the ledges: each row juts or recedes by its own noise (the lip overhangs a little, the wall breaks in steps)
        const k = r === 0 ? 0 : (0.35 + 0.65 * (n.get(u * (1 + r * 0.7), r * 3.3) * 0.5 + 0.5)) * bulge + (r === 1 ? 0.6 : 0);
        const out = r === ROWS.length - 1 ? 2 : k * (r > 7 ? 1.4 : 1);
        verts.push(x + s.n[0] * out, y, z + s.n[1] * out);
        const depth = Math.min(1, Math.max(0, (y0 - y) / CHUNK_DEPTH));
        if (rock === 0) c.setRGB(grass[0], grass[1], grass[2]);
        else c.copy(rockTop).lerp(rockMid, Math.min(1, depth * 3)).lerp(deep, Math.max(0, depth * 1.3 - 0.3)).multiplyScalar(0.9 + 0.2 * (n.get(u * 4 + r, 9.1) * 0.5 + 0.5));
        cols.push(c.r, c.g, c.b);
        surf.push(9, 0, 0, rock);
        rdir.push(1, 0);
      }
    }
    const per = ROWS.length;
    for (let i = 0; i < segs; i++) for (let r = 0; r < per - 1; r++) {
      const a = base + i * per + r, b = base + (i + 1) * per + r;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const b0 = verts.length / 3;
  verts.push(-H, D, -H, H, D, -H, H, D, H, -H, D, H);
  for (let i = 0; i < 4; i++) { cols.push(deep.r, deep.g, deep.b); surf.push(9, 0, 0, 1); rdir.push(1, 0); }
  idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setAttribute('surf', new THREE.Float32BufferAttribute(surf, 4));
  geo.setAttribute('rdir', new THREE.Float32BufferAttribute(rdir, 2));
  geo.setAttribute('zone', new THREE.Float32BufferAttribute(new Float32Array((verts.length / 3) * 3), 3)); // the walls carry no zone
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

type Seg = [number, number, number, number];
function trailSegments(f: PainterField): Seg[] {
  const out: Seg[] = [];
  for (const poly of f.trails()) for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1]; if (a && b) out.push([a[0], a[1], b[0], b[1]]); }
  return out;
}
/**
 * out = [metres to the nearest trail centreline signed by which side of it (x, z) lies (`cap` when farther), the
 * nearest segment's unit direction x, z] — the road's painted texture is laid along that direction
 */
function signedTrailDistance(segs: Seg[], x: number, z: number, cap: number, out: [number, number, number]): void {
  let best = cap, sign = 1, dx = 1, dz = 0;
  // indexed, not `for (const [ax, az, bx, bz] of segs)`: the destructuring iterated every segment for every terrain vertex,
  // ~0.6 GB of iterator garbage over Nalati's load (NALATI-FINISH B8, E302)
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (s === undefined) continue;
    const ax = s[0], az = s[1], bx = s[2], bz = s[3];
    const vx = bx - ax, vz = bz - az, wx = x - ax, wz = z - az;
    const l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, (wx * vx + wz * vz) / l2)) : 0;
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < best) { best = d; sign = vx * wz - vz * wx >= 0 ? 1 : -1; const l = Math.sqrt(l2) || 1; dx = vx / l; dz = vz / l; }
  }
  out[0] = best * sign; out[1] = dx; out[2] = dz;
}
