import { BackSide, ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, UnsignedByteType, type Vector3 } from 'three';
import { SKY } from './sun';

/**
 * The golden-hour sky at infinity (review 2026-10-01 item 2): a painted cumulus panorama baked once at load into a small
 * 512×96 data texture (seamless around the horizon; small, the phone gpuMB budget), lit from the low sun, with a band of distant floating-island silhouettes
 * fading into the haze. Nothing here is in the playable space: it is the dome (radius 900 m, drawn first, no depth).
 *
 * The texture covers the band from just under the horizon to `TOP` (the sine of the elevation). Channels:
 *   R  cloud density (0 clear sky, 1 a thick cumulus core)
 *   G  how lit the cloud is (its top edge faces up into the light; its belly is shaded)
 *   B  the distant-island mask (a hazy silhouette band at the horizon)
 */
export const PANO = { width: 512, height: 96, bottom: -0.08, top: 0.62 } as const;
/** Distant islands painted into the matte: [azimuth 0..1, elevation 0..1 in the band, width in u, height in v]. */
const FAR_ISLES: readonly (readonly [number, number, number, number])[] = [
  [0.03, 0.17, 0.018, 0.05], [0.09, 0.2, 0.011, 0.03], [0.16, 0.15, 0.026, 0.07], [0.24, 0.19, 0.009, 0.025],
  [0.31, 0.16, 0.02, 0.05], [0.38, 0.21, 0.012, 0.03], [0.47, 0.18, 0.016, 0.045], [0.55, 0.15, 0.024, 0.06],
  [0.63, 0.2, 0.01, 0.028], [0.7, 0.17, 0.019, 0.05], [0.78, 0.22, 0.008, 0.022], [0.85, 0.16, 0.022, 0.06],
  [0.91, 0.19, 0.012, 0.032], [0.97, 0.15, 0.015, 0.04],
];

function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
/** Value noise, periodic in x with period `px` lattice cells (so the panorama wraps without a seam). */
function noise(x: number, y: number, px: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
  const a = hash(x0, yi), b = hash(x1, yi), c = hash(x0, yi + 1), d = hash(x1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** fbm with cells about three times wider than tall (cumulus banks, not streaks). */
function fbm(u: number, v: number, base: number): number {
  let sum = 0, amp = 0.55, f = base, norm = 0;
  for (let o = 0; o < 5; o++) { sum += amp * noise(u * f, v * f * 0.36 + o * 17.3, f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The cloud density at band coordinates (u around, v up 0..1): cumulus banks low, thinning to wisps high up. */
function density(u: number, v: number): number {
  const n = fbm(u, v, 24), detail = fbm(u + 0.37, v + 3.1, 64);
  const bank = smooth(0.0, 0.12, v) * (1 - smooth(0.35, 0.95, v));
  const cover = 0.36 + 0.1 * (1 - bank);
  return smooth(cover, cover + 0.16, n * 0.78 + detail * 0.22) * (0.5 + 0.5 * bank);
}

/** Bake the panorama (≈ 40 ms on a phone; once per level load). */
export function bakePanorama(): DataTexture {
  const { width: W, height: H } = PANO, data = new Uint8Array(W * H * 4), d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[y * W + x] = density(x / W, y / H);
  const at = (x: number, y: number): number => d[Math.min(H - 1, Math.max(0, y)) * W + ((x + W) % W)] ?? 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, here = at(x, y);
    // lit: the cloud thins above this texel (its top faces the sky light); shaded: it thickens above (a belly)
    const above = (at(x, y + 1) + at(x, y + 2)) * 0.5, lit = smooth(-0.15, 0.25, here - above);
    let isle = 0;
    for (const [iu, iv, iw, ih] of FAR_ISLES) {
      let du = Math.abs(x / W - iu); du = Math.min(du, 1 - du);
      const dv = y / H - iv;
      // a flat top and a keel tapering to a point below
      const halfW = dv >= 0 ? iw * (1 - smooth(ih * 0.1, ih * 0.25, dv)) : iw * Math.max(0, 1 + dv / ih) ** 1.4;
      if (dv < ih * 0.25 && dv > -ih && du < halfW) isle = Math.max(isle, smooth(halfW, halfW * 0.7, du));
    }
    data[i * 4] = Math.round(here * 255); data[i * 4 + 1] = Math.round(lit * 255); data[i * 4 + 2] = Math.round(isle * 255); data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}

function hex(value: number): string { const c = new Color(value); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }

/** The dome: gradient + sun bloom + the baked cumulus, lit from `sunDir`. */
export function skyDome(sunDir: Vector3, pano: DataTexture): Mesh<SphereGeometry, ShaderMaterial> {
  return new Mesh(new SphereGeometry(900, 48, 24), new ShaderMaterial({ side: BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir }, pano: { value: pano } },
    vertexShader: 'varying vec3 d; void main(){ d=position; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; }',
    fragmentShader: /* glsl */`
      uniform vec3 sunDir; uniform sampler2D pano; varying vec3 d;
      void main(){
        vec3 n = normalize(d); float h = n.y;
        float s = max(dot(n, sunDir), 0.0);
        vec3 c = mix(${hex(SKY.horizon)}, ${hex(SKY.mid)}, smoothstep(0.0, 0.2, h));
        c = mix(c, ${hex(SKY.zenith)}, smoothstep(0.2, 0.8, h));
        c = mix(c, ${hex(SKY.below)}, smoothstep(0.0, -0.1, h));
        // the sun's glow: a wide warm wash toward the sun, a hot core
        c = mix(c, ${hex(SKY.horizon)} * 1.08, pow(s, 3.0) * 0.55 * (1.0 - smoothstep(0.1, 0.6, h)));
        vec2 uv = vec2(atan(n.z, n.x) / 6.2831853 + 0.5, (h - ${PANO.bottom.toFixed(3)}) / ${(PANO.top - PANO.bottom).toFixed(3)});
        vec4 p = texture2D(pano, uv);
        float band = smoothstep(0.0, 0.04, uv.y) * (1.0 - smoothstep(0.92, 1.0, uv.y));
        // distant islands: hazy violet-blue silhouettes, lit gold on the sun side
        vec3 isle = mix(${hex(SKY.isle)}, ${hex(SKY.isleLit)}, pow(s, 4.0));
        c = mix(c, isle, p.b * band * 0.75);
        // the cumulus: shaded bellies mauve, lit tops gold-pink, a silver lining toward the sun
        float k = p.r * band;
        vec3 shade = mix(${hex(SKY.cloudShade)}, ${hex(SKY.cloudShadeWarm)}, pow(s, 2.0));
        vec3 lit = mix(${hex(SKY.cloudLit)}, ${hex(SKY.sun)} * 1.25, pow(s, 6.0));
        vec3 cloud = mix(shade, lit, p.g);
        cloud += ${hex(SKY.sun)} * pow(s, 10.0) * (1.0 - p.r) * 1.6;
        c = mix(c, cloud, smoothstep(0.02, 0.5, k));
        c += ${hex(SKY.sun)} * (pow(s, 64.0) * 1.4 + pow(s, 8.0) * 0.28) * (1.0 - k * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }` }));
}
