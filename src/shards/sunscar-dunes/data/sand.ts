import { GROUND_HALF } from './layout';

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
/**
 * The baked maps as the client uploads them (`@wildshard/sdk/looks/bakedGround` loadBakedMaps): a failed shadow stands in
 * fully lit, a failed trail as no trail, a failed grain as flat grain (round 5: anisotropic, so the grazing near view keeps it).
 */
export const SAND_MAPS = {
  shadow: { url: SAND_FILES.shadow, size: SAND_MAP, channels: 1, standIn: 255 },
  trail: { url: SAND_FILES.trail, size: SAND_MAP, channels: 1, standIn: 0 },
  grain: { url: SAND_FILES.grain, size: GRAIN_TILE, channels: 4, standIn: 128, anisotropy: 8 },
} as const;
/**
 * The skirt round the painted ground (round 2, R1C-5): past the ground's edge its edge heights ease over 60 m into swells
 * along the wind (`world/dunes.ts` WIND); the skirt mesh (look/render.ts) and the baked dune-shadow map
 * (generators/sand.ts) both stand on it.
 */
export const SKIRT_SWELL = { edge: GROUND_HALF, inside: -0.5, ease: 60, wind: [-0.643, 0.766], along: 64, across: 90, base: 2.5, swell: 3, wobble: 0.4, drop: 0.05 } as const;
/** The skirt grid: 8 m a quad out to 520 m (G99: a grid cell's ends at its cube), 2 m under the ground inside its edge. */
export const SKIRT_GRID = { reach: 520, cell: 8, sink: 2 } as const;
