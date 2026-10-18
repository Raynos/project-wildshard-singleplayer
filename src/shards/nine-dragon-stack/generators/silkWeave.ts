import { Rng } from '@wildshard/engine/core/rng';

/** Exact R8 slub weave, baked once into the product instead of rebuilding on entry. */
export function silkWeaveBytes(size = 256, seed = 77): Uint8Array {
  const N = size, data = new Uint8Array(N * N), raw = new Float32Array(N * N);
  const r = new Rng(seed);
  const warp = Array.from({ length: N / 2 }, () => r.range(-1, 1));
  const weft = Array.from({ length: N / 2 }, () => r.range(-1, 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = x >> 1, ty = y >> 1;
    const over = ((tx + ty) & 1) === 0;
    const thread = over ? (warp[tx] ?? 0) * 0.5 : (weft[ty] ?? 0) * 0.5;
    const slub = Math.sin((x + (weft[ty] ?? 0) * 11) * 0.13) * 0.18 + Math.sin((y + (warp[tx] ?? 0) * 9) * 0.11) * 0.18;
    raw[y * N + x] = thread * 36 + slub * 44 + (r.next() - 0.5) * 22;
  }
  const sorted = Float32Array.from(raw).sort();
  const lo = sorted[Math.floor(N * N * 0.01)] ?? -1, hi = sorted[Math.floor(N * N * 0.99)] ?? 1;
  for (let i = 0; i < N * N; i++) data[i] = Math.max(0, Math.min(255, Math.round((((raw[i] ?? 0) - lo) / (hi - lo)) * 255)));
  return data;
}

/** Exact R8 four-texel plain weave used by the live first-person arms. */
export function plainWeaveBytes(size = 256, seed = 77): Uint8Array {
  const N = size;
  const data = new Uint8Array(N * N);
  let s = seed;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const warp = Array.from({ length: N / 4 }, () => rnd() * 2 - 1);
  const weft = Array.from({ length: N / 4 }, () => rnd() * 2 - 1);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const tx = x >> 2, ty = y >> 2;
      const over = ((tx + ty) & 1) === 0;
      const px = 1 - Math.abs(((x & 3) + 0.5) / 4 - 0.5) * 2, py = 1 - Math.abs(((y & 3) + 0.5) / 4 - 0.5) * 2;
      const thread = over ? (warp[tx] ?? 0) * 0.4 + px * 0.6 - 0.3 : (weft[ty] ?? 0) * 0.4 + py * 0.6 - 0.3;
      data[y * N + x] = Math.max(0, Math.min(255, Math.round(128 + thread * 60 + (rnd() - 0.5) * 20)));
    }
  }
  return data;
}
