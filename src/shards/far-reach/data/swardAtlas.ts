/**
 * The sward's tuft atlas (E407 row 4, a green, varied meadow; the mockups' sward is three grasses at once: a fine low
 * lawn, broad arching blades and tall wild stalks with seed heads). `variants` tufts side by side, each `w × h` texels,
 * two per species in species order (lawn, broad, wild), drawn offline (generators/swardAtlas.ts → baked/sward-atlas.bin).
 * The channels are data, not colour: R the strand's own shade, G how far along its strand the texel is (0 root, 1 tip), B where across its blade the texel
 * sits (0 one edge, 255 the other: world/meadow.ts lights the sun-side edge and the midrib from it), A the coverage.
 */
export const SWARD_ATLAS = { variants: 6, perSpecies: 2, w: 192, h: 512 } as const;

