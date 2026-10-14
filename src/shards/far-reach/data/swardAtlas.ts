/**
 * The sward's tuft atlas (E407 row 4, a green, varied meadow; the mockups' sward is three grasses at once: a fine low
 * lawn, broad arching blades and tall wild stalks with seed heads). `variants` tufts side by side, each `w × h` texels,
 * two per species in species order (lawn, broad, wild), drawn offline (generators/swardAtlas.ts → the library texture below).
 * The channels are data, not colour: R the strand's own shade, G how far along its strand the texel is (0 root, 1 tip), B where across its blade the texel
 * sits (0 one edge, 255 the other: data/meadowLook.ts lights the sun-side edge and the midrib from it), A the coverage.
 */
export const SWARD_ATLAS = { variants: 6, perSpecies: 2, w: 192, h: 512 } as const;



/** The atlas as a cached, hash-named library texture (generators/swardAtlas.ts `bakeSwardAtlasTexture`): lossless, linear
 *  (its channels are data), one level; the meadow graph samples it with GPU mips, as the DataTexture did. */
export const SWARD_ATLAS_FILE = {
  hash: '607c53f28dbdd88423b39fd32419ba735f9a13c3c1ecabaf1cadb68715d63f0b',
  kind: 'ktx2',
  compressed: 663989,
  decoded: 0,
  gpu: 2359296,
  triangles: 0,
  draws: 0,
  dependencies: [],
  critical: false,
} as const;

/** Match the DataTexture: linear filtering over GPU-built mips, clamped. */
export const SWARD_ATLAS_SAMPLER = { filter: 'linear', mips: 'gpu' } as const;
