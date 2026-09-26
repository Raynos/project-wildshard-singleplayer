// Copied from the light lab (src/dev/nd-lab/light/lightvol.ts, round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): warm LIGHT POOLS from every lantern, shop front, lamp and sign, baked once at build time into
// a small 3D irradiance texture (a "light volume") that every architecture program samples per pixel — one trilinear
// fetch per volume, any number of lights, no per-pixel light loop, no extra draw, no overdraw.
//
//  - A light is { at, color, k, r }: irradiance k·color / (1 + d²/r²), tapered to 0 at `cut`·r (a smooth window, so
//    the volume's bounds never show). Colours are linear.
//  - Two volumes: the square level (x −30…75, z −175…28, y +123…+171, 1 m cells) and the Well shaft below it
//    (1.5 m cells), each RGBA8: rgb = √(E / MAX) (perceptual, so the 8 bits go to the dim pool edges), a = the
//    luminance-weighted mean light direction's "up" share (0.5 + 0.5·ŷ) — the shader uses it to keep light that comes
//    from above off undersides and light from shop interiors (level) on walls and awnings.
//  - Bake: every light splats only the cells within cut·r (a 5 m lantern pool touches ~1.7k cells): 20 ms for the
//    clean room's 9.6k lights (387 lanterns, 84 shops / stalls, 4 lamps, 307 signs, 8784 lit windows) in JS. GPU memory:
//    4.2 MB (square, 106 × 49 × 204) + 0.6 MB (Well, 23 × 150 × 44), RGBA8.
//  - GLSL (`LIGHTVOL_GLSL`): `vec3 poolLight(vec3 wp, vec3 n)` = the irradiance at wp, shaped by the normal. The
//    material adds `albedo × poolLight × uLpGain.x` to its wash and, on wet ground, a broad glossy sheen
//    `poolLight × wet × uLpGain.y` (the wet stone's blurred reflection of the pool's light).
import { ClampToEdgeWrapping, type Color, Data3DTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector3, Vector4 } from 'three';

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

export interface VolumeBox { min: Vector3; max: Vector3; cell: number }

/** the square level and the Well shaft (Lantern Square's layout.ts: WELL x −28…0, z −44…16; Y0 = 125) */
export const SQUARE_BOX: VolumeBox = { min: new Vector3(-30, 123, -175), max: new Vector3(75, 171, 28), cell: 1 };
export const WELL_BOX: VolumeBox = { min: new Vector3(-30, -100, -46), max: new Vector3(2, 123, 18), cell: 1.5 };

/** E is stored as √(E / MAX): MAX is the brightest irradiance the volume holds */
export const LP_MAX = 6;

function blank(): Data3DTexture {
  const t = new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1);
  t.needsUpdate = true;
  return t;
}

/** uniforms the architecture programs share (add them to the clean room's Shared.u) */
export function lightVolUniforms(): {
  uLpVolA: { value: Data3DTexture }; uLpMinA: { value: Vector3 }; uLpInvA: { value: Vector3 };
  uLpVolB: { value: Data3DTexture }; uLpMinB: { value: Vector3 }; uLpInvB: { value: Vector3 };
  uLpGain: { value: Vector4 };
  uLpSky: { value: number };
  uLpAmb: { value: number };
} {
  return {
    uLpVolA: { value: blank() }, uLpMinA: { value: new Vector3() }, uLpInvA: { value: new Vector3() },
    uLpVolB: { value: blank() }, uLpMinB: { value: new Vector3() }, uLpInvB: { value: new Vector3() },
    /** x: diffuse gain on the wash, y: wet sheen gain, z: underside keep (0 = light from above never reaches an underside), w: on / off */
    uLpGain: { value: new Vector4(1.0, 0.5, 0.35, 1) },
    /** the wet film's reflection of the blue-hour sky, added to the clean room's own fresnel term (0 = off): the
     *  targets' wet ground is a lit blue-grey (L* 33 at the FP frames) */
    uLpSky: { value: 0 },
    /** the blue-hour AMBIENT: the sky light on every non-emissive wash (1 = the clean room). Emitters, pools and ink
     *  are not scaled, so a lower ambient makes the lights read as light */
    uLpAmb: { value: 1 },
  };
}

export interface BakeStats { lights: number; cells: number; ms: number; maxE: number }

/** bake `lights` into one volume; returns the texture and fills min / inv */
export function bakeVolume(lights: readonly PoolLight[], box: VolumeBox, min: Vector3, inv: Vector3): { tex: Data3DTexture; stats: BakeStats } {
  const t0 = performance.now();
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
    data[i * 4] = Math.round(Math.sqrt(Math.min(r / LP_MAX, 1)) * 255);
    data[i * 4 + 1] = Math.round(Math.sqrt(Math.min(g / LP_MAX, 1)) * 255);
    data[i * 4 + 2] = Math.round(Math.sqrt(Math.min(b / LP_MAX, 1)) * 255);
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
  return { tex, stats: { lights: used, cells: N, ms: performance.now() - t0, maxE } };
}

/**
 * poolLight(wp, n): the baked irradiance at a world point, shaped by the surface normal. `a` holds where the light
 * comes from (0 = below, 0.5 = level, 1 = above): a floor under a lantern takes all of it, a wall facing it most, an
 * underside only uLpGain.z of the light that comes from above (an awning over a lit shop still glows from below).
 */
export const LIGHTVOL_GLSL = /* glsl */ `
uniform highp sampler3D uLpVolA;
uniform highp sampler3D uLpVolB;
uniform vec3 uLpMinA;
uniform vec3 uLpInvA;
uniform vec3 uLpMinB;
uniform vec3 uLpInvB;
uniform vec4 uLpGain;
uniform float uLpSky;
uniform float uLpAmb;
vec4 lpSample(highp sampler3D v, vec3 wp, vec3 mn, vec3 iv) {
  vec3 t = (wp - mn) * iv;
  if (any(lessThan(t, vec3(0.0))) || any(greaterThan(t, vec3(1.0)))) return vec4(0.0, 0.0, 0.0, 0.5);
  return texture(v, t);
}
vec3 poolLight(vec3 wp, vec3 n) {
  if (uLpGain.w < 0.5) return vec3(0.0);
  vec4 s = wp.y > uLpMinA.y ? lpSample(uLpVolA, wp, uLpMinA, uLpInvA) : lpSample(uLpVolB, wp, uLpMinB, uLpInvB);
  vec3 E = s.rgb * s.rgb * ${LP_MAX.toFixed(1)};
  float fromUp = s.a * 2.0 - 1.0;
  // facing: the light's mean direction is mostly vertical (up / down) with a level share; walls take the level share
  float fUp = max(fromUp, 0.0), fDown = max(-fromUp, 0.0), fLevel = 1.0 - abs(fromUp);
  float face = fUp * mix(uLpGain.z, 1.0, clamp(n.y * 0.5 + 0.5, 0.0, 1.0))
             + fDown * clamp(0.6 - n.y * 0.6, 0.15, 1.0)
             + fLevel * (abs(n.y) < 0.5 ? 1.0 : 0.85);
  return E * face;
}
`;
