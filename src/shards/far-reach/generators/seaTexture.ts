import { SUN_DIR } from '../look/sun';
import { SEA } from '../look/cloudSea';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by scripts/bake-sky-world.mjs into data/seaTexture.json; the client
 * (look/cloudSea.ts seaTexture) uploads the bytes as the cloud sea's and the storm's small tileable cloud texture.
 *
 * R: density (a periodic fbm over the unit square, so it tiles seamlessly); G: lit (the side of a puff that faces the sun),
 * baked for the fixed sun's heading (look/sun.ts SUN_DIR, from the painted panorama).
 */

function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, y: number, p: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % p) + p) % p, x1 = (x0 + 1) % p, y0 = ((yi % p) + p) % p, y1 = (y0 + 1) % p;
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1), d = hash(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** Periodic fbm over the unit square (tiles seamlessly). */
function fbm(u: number, v: number): number {
  let sum = 0, amp = 0.55, f = 4, norm = 0;
  for (let o = 0; o < 5; o++) { sum += amp * noise(u * f + o * 7.1, v * f + o * 3.7, f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

function seaBytes(sun: { readonly x: number; readonly z: number }): Uint8Array {
  const N = SEA.size, d = new Float32Array(N * N), data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) d[y * N + x] = fbm(x / N, y / N);
  const at = (x: number, y: number): number => d[(((y % N) + N) % N) * N + (((x % N) + N) % N)] ?? 0;
  const h = Math.hypot(sun.x, sun.z) || 1, sx = Math.round((sun.x / h) * 2), sy = Math.round((sun.z / h) * 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = at(x, y), toward = at(x + sx, y + sy), lit = Math.min(1, Math.max(0, 0.55 + (here - toward) * 6));
    const i = y * N + x; data[i * 4] = Math.round(here * 255); data[i * 4 + 1] = Math.round(lit * 255); data[i * 4 + 2] = 0; data[i * 4 + 3] = 255;
  }
  return data;
}

/** The texture's rows: its size and its RGBA bytes (base64). */
export function bakeSkySeaTexture(): { size: number; rgba: string } {
  return { size: SEA.size, rgba: btoa(String.fromCodePoint(...seaBytes(SUN_DIR))) };
}
