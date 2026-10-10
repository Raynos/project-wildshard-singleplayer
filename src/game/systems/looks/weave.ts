import { DataTexture, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from 'three';

/** A plain-weave grain (R8, repeating, mipmapped): threads of 4 texels, over / under in a checker, each warp and weft
 *  thread's tone and a per-texel grit from a seeded Park-Miller generator. `size` is a multiple of 4. */
export function plainWeaveTexture(size = 256, seed = 77): DataTexture {
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
  const t = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
