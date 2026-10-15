/**
 * The hunter's coat as waxed canvas, one 128² tile (the painter runtime/viewmodel/gloveHands.ts ran at every launch, moved
 * offline by bake-pine-painted.mjs): a plain weave (16 threads a tile: it melts into the mips at arm's length), slubs,
 * mottled wax (the albedo × 0.8–1.1 over the vertex colour; the roughness 0.5–0.85: the wax shines where the cloth is
 * rubbed) and soft creases in the normal. Albedo sRGB; normal and ARM (ao · roughness · metal 0) linear; repeat-wrapped.
 * Rows run as the old DataTexture's did: row 0 is v = 0.
 */

/** smooth hash */
function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
/** tileable value noise on a `per`-cell lattice */
function tnoise(x: number, y: number, per: number, seed: number): number {
  const h = (i: number, j: number): number => hash((((i % per) + per) % per) + seed * 17, (((j % per) + per) % per) - seed * 13);
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** The tile's side (px). */
export const COAT_SIZE = 128;

/** The coat's three RGBA8 maps, row 0 at v = 0. */
export function coatPixels(): { map: Uint8ClampedArray; normalMap: Uint8ClampedArray; arm: Uint8ClampedArray } {
  const S = COAT_SIZE, N = 16;
  const hgt = new Float32Array(S * S), col = new Uint8ClampedArray(S * S * 4), arm = new Uint8ClampedArray(S * S * 4), nrm = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const cu = u * N, cv = v * N, over = (Math.floor(cu) + Math.floor(cv)) % 2 === 0;
    const warp = Math.sin((cu % 1) * Math.PI), weft = Math.sin((cv % 1) * Math.PI), th = over ? warp : weft;
    const slub = tnoise(u * 8, v * 32, 8, 3) * 0.5 + tnoise(u * 16, v * 16, 16, 5) * 0.5;
    const crease = tnoise(u * 4 + v * 2, v * 4, 4, 7);
    const mott = tnoise(u * 4, v * 4, 4, 11) * 0.6 + tnoise(u * 8, v * 8, 8, 2) * 0.4;
    hgt[y * S + x] = th * 0.55 + slub * 0.25 + crease * 0.9;
    const i = (y * S + x) * 4, a = Math.min(1, 0.8 + 0.3 * mott - 0.1 * (1 - th));
    col[i] = col[i + 1] = col[i + 2] = Math.round(a * 255); col[i + 3] = 255;
    arm[i] = Math.round((0.85 + 0.15 * th) * 255); arm[i + 1] = Math.round((0.5 + 0.35 * (1 - mott)) * 255); arm[i + 2] = 0; arm[i + 3] = 255;
  }
  const at = (xx: number, yy: number): number => hgt[(((yy + S) % S) * S) + ((xx + S) % S)] ?? 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.6, dy = (at(x, y + 1) - at(x, y - 1)) * 1.6;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nrm[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); nrm[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); nrm[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nrm[i + 3] = 255;
  }
  return { map: col, normalMap: nrm, arm };
}
