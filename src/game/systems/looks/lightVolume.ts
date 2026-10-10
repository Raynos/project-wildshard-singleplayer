// lightVolume — light pools baked into a small 3D irradiance texture (SHARD-PLATFORM M3, ex Nine Dragon's
// look/light/lightvol.ts, lab P6 "light", E169): every architecture program samples it per pixel — one trilinear fetch
// per volume, any number of lights, no per-pixel light loop, no extra draw. A light is { at, color, k, r, cut }:
// irradiance k·color / (1 + d²/r²), tapered to 0 at cut·r (a smooth window, so the volume's bounds never show), colours
// linear. Each cell is RGBA8: rgb = √(E / scale) (perceptual: the 8 bits go to the dim pool edges), a = the
// luminance-weighted mean light direction's "up" share (0.5 + 0.5·ŷ). Every light splats only the cells within cut·r.
// The shader's sampling GLSL and its uniforms are the caller's.
//
//   const { tex } = bakeLightVolume(lights, { min, max, cell: 1 }, 12, uMin.value, uInv.value);
import { ClampToEdgeWrapping, type Color, Data3DTexture, LinearFilter, RGBAFormat, UnsignedByteType, type Vector3 } from 'three';
import { diagnosticNow } from '@wildshard/engine/core/clock';

/** A pool light: where, its linear colour, its strength k, its falloff radius r and its hard reach in units of r. */
export interface PoolLight {
  at: Vector3;
  /** linear colour */
  color: Color;
  /** strength (irradiance at the light) */
  k: number;
  /** falloff radius, m: E = k / (1 + d² / r²) */
  r: number;
  /** hard reach in units of r (a smooth taper to 0 there) */
  cut: number;
}

/** A volume's world box and its cell size (m). */
export interface VolumeBox { min: Vector3; max: Vector3; cell: number }

/** One bake's numbers: the lights that touched the box, its cells, its time (ms) and the brightest irradiance. */
export interface BakeStats { lights: number; cells: number; ms: number; maxE: number }

/** A 1³ placeholder volume (no light, "up" share ½) until the bake lands. */
export function blankLightVolume(): Data3DTexture {
  const t = new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Bake `lights` into one volume (irradiance stored as √(E / scale)); returns the texture and fills min / inv (uvw = (p − min) · inv). */
export function bakeLightVolume(lights: readonly PoolLight[], box: VolumeBox, scale: number, min: Vector3, inv: Vector3): { tex: Data3DTexture; stats: BakeStats } {
  const t0 = diagnosticNow();
  const nx = Math.ceil((box.max.x - box.min.x) / box.cell) + 1;
  const ny = Math.ceil((box.max.y - box.min.y) / box.cell) + 1;
  const nz = Math.ceil((box.max.z - box.min.z) / box.cell) + 1;
  const N = nx * ny * nz;
  const er = new Float32Array(N), eg = new Float32Array(N), eb = new Float32Array(N), up = new Float32Array(N), wsum = new Float32Array(N);
  const c = box.cell;
  let used = 0;
  for (const L of lights) {
    const reach = L.r * L.cut;
    if (L.at.x + reach < box.min.x || L.at.x - reach > box.max.x || L.at.y + reach < box.min.y || L.at.y - reach > box.max.y
      || L.at.z + reach < box.min.z || L.at.z - reach > box.max.z) continue;
    used++;
    const i0 = Math.max(0, Math.floor((L.at.x - reach - box.min.x) / c)), i1 = Math.min(nx - 1, Math.ceil((L.at.x + reach - box.min.x) / c));
    const j0 = Math.max(0, Math.floor((L.at.y - reach - box.min.y) / c)), j1 = Math.min(ny - 1, Math.ceil((L.at.y + reach - box.min.y) / c));
    const k0 = Math.max(0, Math.floor((L.at.z - reach - box.min.z) / c)), k1 = Math.min(nz - 1, Math.ceil((L.at.z + reach - box.min.z) / c));
    const r2 = L.r * L.r, reach2 = reach * reach;
    const lum = 0.2126 * L.color.r + 0.7152 * L.color.g + 0.0722 * L.color.b;
    for (let k = k0; k <= k1; k++) {
      const dz = box.min.z + k * c - L.at.z;
      for (let j = j0; j <= j1; j++) {
        const dy = box.min.y + j * c - L.at.y;
        for (let i = i0; i <= i1; i++) {
          const dx = box.min.x + i * c - L.at.x;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= reach2) continue;
          const win = 1 - d2 / reach2;
          const e = (L.k * win * win) / (1 + d2 / r2);
          const idx = (k * ny + j) * nx + i;
          er[idx] = (er[idx] ?? 0) + L.color.r * e;
          eg[idx] = (eg[idx] ?? 0) + L.color.g * e;
          eb[idx] = (eb[idx] ?? 0) + L.color.b * e;
          // the direction TO the light, its vertical share, luminance-weighted
          const dl = Math.sqrt(Math.max(d2, 1e-4));
          const w = e * lum;
          up[idx] = (up[idx] ?? 0) + (-dy / dl) * w;
          wsum[idx] = (wsum[idx] ?? 0) + w;
        }
      }
    }
  }
  const data = new Uint8Array(N * 4);
  let maxE = 0;
  for (let i = 0; i < N; i++) {
    const r = er[i] ?? 0, g = eg[i] ?? 0, b = eb[i] ?? 0;
    maxE = Math.max(maxE, r, g, b);
    data[i * 4] = Math.round(Math.sqrt(Math.min(r / scale, 1)) * 255);
    data[i * 4 + 1] = Math.round(Math.sqrt(Math.min(g / scale, 1)) * 255);
    data[i * 4 + 2] = Math.round(Math.sqrt(Math.min(b / scale, 1)) * 255);
    const ws = wsum[i] ?? 0;
    data[i * 4 + 3] = Math.round((0.5 + 0.5 * (ws > 1e-6 ? (up[i] ?? 0) / ws : 0)) * 255);
  }
  const tex = new Data3DTexture(data, nx, ny, nz);
  tex.format = RGBAFormat;
  tex.type = UnsignedByteType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  // texel centres: cell i sits at min + i·cell, so uvw = (p − min + cell/2) / (n·cell)
  min.copy(box.min).subScalar(c / 2);
  inv.set(1 / (nx * c), 1 / (ny * c), 1 / (nz * c));
  return { tex, stats: { lights: used, cells: N, ms: diagnosticNow() - t0, maxE } };
}
