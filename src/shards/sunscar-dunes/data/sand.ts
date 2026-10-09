/**
 * The sand's baked maps (SF72, `generators/sand.ts` → `scripts/bake-signal-sand.mjs`): their sizes and reach, and the key
 * light's direction the dune-shadow map marches toward (look/render.ts KEY lights the scene from the same direction).
 */
/** The key light's direction before normalising (look/render.ts KEY): 20 deg left of north, ~11 deg up. */
export const KEY_DIR = [-0.34, 0.2, -0.92] as const;
/** The baked key-shadow map's reach (m either side of the centre): the far skirt's dunes cast shade too. */
export const SHADOW_HALF = 520;
/** The dune-shadow and trail maps' texels a side (E407 row 3: 1.16 m a texel over the shadow's reach). */
export const SAND_MAP = 896;
/** The sand grain tile's texels a side (1.8 m a tile, RGBA: albedo, bump x, bump z, 255). */
export const GRAIN_TILE = 256;
/** The baked maps the client reads (each a zlib stream of the map's raw bytes). */
export const SAND_FILES = { shadow: '/assets/sunscar-dunes/sand/shadow.bin', trail: '/assets/sunscar-dunes/sand/trail.bin', grain: '/assets/sunscar-dunes/sand/grain.bin' } as const;
