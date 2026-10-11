/** Mulberry32 draws used by the authored seed permutation; no session or RNG service is installed. */
function seededDraw(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const grad3: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const G_NONE: readonly [number, number] = [0, 0]; // never hit: `% 8` keeps the index in range; satisfies noUncheckedIndexedAccess

/** Retained seeded simplex channel for Driftwood authoring; no runtime RNG service. */
export class DriftwoodNoise {
  private perm = new Uint8Array(512);
  constructor(seed: number) {
    const draw = seededDraw(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(draw() * (i + 1)); [p[i], p[j]] = [p[j] ?? 0, p[i] ?? 0]; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] ?? 0;
  }
  /** returns roughly [-1, 1] */
  get(xin: number, yin: number): number {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = grad3[(perm[ii + (perm[jj] ?? 0)] ?? 0) % 8] ?? G_NONE; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = grad3[(perm[ii + i1 + (perm[jj + j1] ?? 0)] ?? 0) % 8] ?? G_NONE; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = grad3[(perm[ii + 1 + (perm[jj + 1] ?? 0)] ?? 0) % 8] ?? G_NONE; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }
  /** Retained native octave sum and normalisation order. */
  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += a * this.get(x * f, y * f); norm += a; a *= gain; f *= lacunarity; }
    return sum / norm;
  }
}

/** Exact native interpolation helpers used by the retained height law. */
export const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Clamp a native source value without changing operation order. */
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
/** Native interpolation order, preserved for the source oracle. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
