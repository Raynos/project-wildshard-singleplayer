/**
 * E156 — the ground wears the cover. Driftwood's ground cover is drawn only round the camera (GroundCover.ts, the Blender
 * cove's cover tiles); past that the terrain was bare facet colour, so plants seemed to appear as you walked up to them.
 * This is a chunk-wide grid of what the cover makes the ground look like: per 4 m cell the share of the ground the plants
 * cover seen from straight above (`top`), how much they hide seen from the side (`side`: their upright blades and fronds)
 * and their mean colour (`rgb`). GroundCover fills it from its own density rules;
 * the Blender island overwrites its area from the cover it actually placed. The terrains sample it per vertex (`aCover`,
 * `flat`, like their colour), and their shader mixes the facet towards the cover colour by how much of the ground the
 * plants hide *from where you look*: a little from above, nearly all of it at the grazing angle far ground is seen at.
 * That is what the 3D plants do, so the far ground already reads as the plants, and the plants fade into it (they take the
 * same colour, `coverSeen`, instead of the bare facet's).
 *
 *   const grid = CoverGrid.create();          // GroundCover.build() fills it (grid.fill), the Blender cove splats its own
 *   tintTerrain(terrain.mesh);                // after the fill: aCover per vertex + the shader
 *
 * Pause ▸ Settings ▸ Debug ▸ Ground cover ▸ Ground tint turns it off live (the grid stays built; uCoverTint goes to 0).
 */
import * as THREE from 'three';
import { CHUNK_HALF, CHUNK_SIZE } from '../core/config';
import { setting, onSettingChange } from '../ui/Settings';

/** the shaders' switch: pause ▸ Settings ▸ Debug ▸ Ground cover ▸ Ground tint (live) */
export const coverTintUniform = { value: setting('coverTint') === 'on' ? 1 : 0 };
onSettingChange('coverTint', (v) => { coverTintUniform.value = v === 'on' ? 1 : 0; });

/** metres per grid cell */
const STEP = 4;
const N = Math.ceil(CHUNK_SIZE / STEP) + 1;

/**
 * How much of the ground the cover hides seen at `facing` (|cos| between the ground's normal and the view ray; 1 from
 * straight above, → 0 grazing). Plants scattered on a plane hide it with optical depth τ = n·(top + side·cot θ): their
 * ground footprint, plus their upright cross-section times the tangent of the view's tilt. `top` and `side` come packed
 * as 1 − e^−τ (0..1, so they fit a byte). Shared by the terrain and GroundCover's plants, so a plant fades into exactly
 * the colour its ground is drawn in from there.
 */
export const COVER_SEEN_GLSL = /* glsl */`
float coverSeen( float top, float side, float facing ) {
  float f = clamp( facing, 0.03, 1.0 );
  float tau = -log( max( 1.0 - top, 1e-3 ) ) - log( max( 1.0 - side, 1e-3 ) ) * sqrt( 1.0 - f * f ) / f;
  return 1.0 - exp( -tau );
}`;

/** what the grid holds at a point: mean colour (linear), and top / side packed as 1 − e^−τ */
export interface CoverSample { r: number; g: number; b: number; top: number; side: number }
export const coverSample = (): CoverSample => ({ r: 0, g: 0, b: 0, top: 0, side: 0 });
const W = 5;

/** one triangle of cover for CoverGrid.splat: centre (x, z), ground (top) and upright (side) areas, colour */
export interface CoverTri { x: number; z: number; top: number; side: number; r: number; g: number; b: number }

/**
 * A triangle's ground area (its XZ projection) and its upright cross-section (the mean of its XY and ZY projections: a
 * plant stands at any yaw), as CoverTri.top / side. Shared by GroundCover's per-kind look and the Blender cove's splat.
 */
export function triAreas(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): { top: number; side: number } {
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  return { top: Math.abs(ny) / 2, side: (Math.abs(nx) + Math.abs(nz)) / 4 };
}

export class CoverGrid {
  /** r, g, b (linear, like the vertex colours), top, side (1 − e^−τ) per cell */
  readonly data = new Float32Array(N * N * W);
  private static current: CoverGrid | null = null;

  /** the chunk's grid (a new shard load starts a new one) */
  static create(): CoverGrid { CoverGrid.current = new CoverGrid(); return CoverGrid.current; }
  static get(): CoverGrid | null { return CoverGrid.current; }

  /** fill every cell centre from `at` (x, z → writes into out, which starts empty: leave it for none) */
  fill(at: (x: number, z: number, out: CoverSample) => void, x0 = -CHUNK_HALF, x1 = CHUNK_HALF, z0 = -CHUNK_HALF, z1 = CHUNK_HALF): void {
    const v = coverSample();
    const i0 = this.ix(x0), i1 = this.ix(x1), k0 = this.ix(z0), k1 = this.ix(z1);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      v.r = 0; v.g = 0; v.b = 0; v.top = 0; v.side = 0;
      at(-CHUNK_HALF + i * STEP, -CHUNK_HALF + k * STEP, v);
      this.data.set([v.r, v.g, v.b, v.top, v.side], (k * N + i) * W);
    }
  }

  /**
   * Overwrite the cells inside [x0, x1] × [z0, z1] from triangles of cover geometry (world space): each triangle adds its
   * ground (top) and upright (side) areas × its colour to its cell. `k` scales area to optical depth (fronds overlap).
   */
  splat(tris: Iterable<CoverTri>, x0: number, x1: number, z0: number, z1: number, k: number): void {
    const acc = new Map<number, [number, number, number, number, number]>();
    for (const t of tris) {
      const c = Math.round((t.z + CHUNK_HALF) / STEP) * N + Math.round((t.x + CHUNK_HALF) / STEP);
      const s = acc.get(c) ?? [0, 0, 0, 0, 0], w = t.top + t.side;
      s[0] += t.r * w; s[1] += t.g * w; s[2] += t.b * w; s[3] += t.top; s[4] += t.side;
      acc.set(c, s);
    }
    const i0 = this.ix(x0), i1 = this.ix(x1), k0 = this.ix(z0), k1 = this.ix(z1), cell = STEP * STEP;
    for (let kk = k0; kk <= k1; kk++) for (let i = i0; i <= i1; i++) {
      const c = kk * N + i, s = acc.get(c), o = c * W, w = s ? s[3] + s[4] : 0;
      if (!s || w <= 0) { this.data.fill(0, o, o + W); continue; }
      this.data.set([s[0] / w, s[1] / w, s[2] / w, 1 - Math.exp(-(s[3] / cell) * k), 1 - Math.exp(-(s[4] / cell) * k)], o);
    }
  }

  /** bilinear sample at (x, z) into out (the colour weighted by cover, so a bare neighbour doesn't grey it) */
  sample(x: number, z: number, out: CoverSample): CoverSample {
    const fx = (x + CHUNK_HALF) / STEP, fz = (z + CHUNK_HALF) / STEP;
    const i = Math.max(0, Math.min(N - 2, Math.floor(fx))), k = Math.max(0, Math.min(N - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), w = Math.min(1, Math.max(0, fz - k));
    let r = 0, g = 0, b = 0, cw = 0, top = 0, side = 0;
    for (const [di, dk, wt] of [[0, 0, (1 - u) * (1 - w)], [1, 0, u * (1 - w)], [0, 1, (1 - u) * w], [1, 1, u * w]] as const) {
      const o = ((k + dk) * N + i + di) * W, t = this.data[o + 3] ?? 0, sd = this.data[o + 4] ?? 0, ca = (t + sd) * wt;
      r += (this.data[o] ?? 0) * ca; g += (this.data[o + 1] ?? 0) * ca; b += (this.data[o + 2] ?? 0) * ca; cw += ca;
      top += t * wt; side += sd * wt;
    }
    if (cw < 1e-5) { out.r = 0; out.g = 0; out.b = 0; out.top = 0; out.side = 0; return out; }
    out.r = r / cw; out.g = g / cw; out.b = b / cw; out.top = top; out.side = side;
    return out;
  }

  private ix(v: number): number { return Math.max(0, Math.min(N - 1, Math.round((v + CHUNK_HALF) / STEP))); }
}

/** ×0.88 … ×1.12 per point, a hash of where it is (the facets of covered ground keep their light / dark mosaic) */
export const coverJitter = (x: number, z: number): number => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return 0.88 + (h - Math.floor(h)) * 0.24; };

/**
 * Give a low-poly terrain mesh the cover's look: an `aCover` attribute (the grid sampled at each vertex's world position,
 * read `flat` like the facet colour: a facet takes its provoking vertex's) and the shader that mixes it in by view angle.
 * `matrixWorld`: the mesh's (the Blender tiles keep meshopt's dequantisation there). Chains the material's own patch.
 */
export function tintTerrain(mesh: THREE.Mesh, matrixWorld = mesh.matrixWorld): void {
  const grid = CoverGrid.get();
  if (!grid) return;
  const geo = mesh.geometry, pos = geo.getAttribute('position'), cover = new Uint8Array(pos.count * 4), side = new Uint8Array(pos.count);
  const p = new THREE.Vector3(), s = coverSample(), byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
    grid.sample(p.x, p.z, s);
    // the facet jitter the terrain's own colour has (Terrain.ts lowPolyGroundColor), so the covered ground still reads as facets
    const j = coverJitter(p.x, p.z);
    cover[i * 4] = byte(s.r * j); cover[i * 4 + 1] = byte(s.g * j); cover[i * 4 + 2] = byte(s.b * j); cover[i * 4 + 3] = byte(s.top);
    side[i] = byte(s.side);
  }
  geo.setAttribute('aCover', new THREE.BufferAttribute(cover, 4, true));
  geo.setAttribute('aCoverSide', new THREE.BufferAttribute(side, 1, true));
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) patchTerrainMaterial(mat);
}

const patched = new WeakSet<THREE.Material>();
function patchTerrainMaterial(mat: THREE.Material): void {
  if (patched.has(mat)) return;
  patched.add(mat);
  const prev = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms['uCoverTint'] = coverTintUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCover;\nattribute float aCoverSide;\nflat varying vec4 vCover;\nflat varying float vCoverSide;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = aCover; vCoverSide = aCoverSide;');
    // after the normal is known (flat: from derivatives) and before the lights read diffuseColor
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nflat varying vec4 vCover;\nflat varying float vCoverSide;\nuniform float uCoverTint;\n${COVER_SEEN_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
	diffuseColor.rgb = mix( diffuseColor.rgb, vCover.rgb, coverSeen( vCover.a, vCoverSide, abs( dot( normal, normalize( vViewPosition ) ) ) ) * uCoverTint );`);
  };
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${key()}|cover-tint`;
  mat.needsUpdate = true;
}
