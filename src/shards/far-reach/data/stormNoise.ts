/** The retained cloud density/light channels, lossless and linear in the cached library. */
export const STORM_NOISE = {
  "hash": "9e04e0e37d62f6e67961705d1b59f30082227cc60df9bf4c6cb0d262845c2e00",
  "kind": "ktx2",
  "compressed": 9463,
  "decoded": 0,
  "gpu": 16384,
  "triangles": 0,
  "draws": 0,
  "dependencies": [],
  "critical": false
} as const;

/** Match the original DataTexture: no mips, linear filtering, periodic UVs. */
export const STORM_NOISE_SAMPLER = { filter: 'linear', wrap: 'repeat', mips: 'file' } as const;
