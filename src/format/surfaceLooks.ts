/**
 * Surface look rows (SHARD-PLATFORM SF72, look-family rows; DS1.1): the pure row contracts of the small, named
 * decorations a shard chains onto a standard material. A shard lists its rows in its own `data/`; the game's
 * `@wildshard/game/systems/looks/surfaceLooks` `applySurfaceLooks` installs them (each family's GLSL lives there). The
 * families:
 *
 * - `firelight`: each burning fire of a shared firelight uniform warms the surface within `reach` metres, falling off as
 *   `(1 - d / reach) ^ falloff`;
 * - `viewerLight`: the viewer-side light of a held part and a glancing sheen at the silhouette;
 * - `leather`: creases and a pebbled grain in the model's own space, as albedo and as a bump on the normal;
 * - `stoneBand`: the model below a height redrawn as rows of irregular fieldstones with mortar between (a plinth);
 * - `desaturate`: the map's colour pulled toward its own luma.
 */

/** RGB, linear. */
export type SurfaceRgb = readonly [number, number, number];

/** Fires warm the surface: `colour` × each fire's gain × `(1 - d / reach) ^ falloff` × `gain`. */
export interface FirelightLook { readonly kind: 'firelight'; readonly colour: SurfaceRgb; readonly reach: number; readonly falloff: number; readonly gain: number }
/**
 * The eye's own light on a held part: `gain` × (`facing[0]` + `facing[1]` × the face's turn to the eye) × (1 + `dusk` ×
 * the dusk uniform), and a sheen of `sheenColour` × `sheen` × (1 - turn) ^ `sheenPower`, damped by roughness × `sheenDamp`.
 */
export interface ViewerLightLook {
  readonly kind: 'viewerLight'; readonly gain: SurfaceRgb; readonly facing: readonly [number, number]; readonly dusk: number;
  readonly sheen: number; readonly sheenColour: SurfaceRgb; readonly sheenPower: number; readonly sheenDamp: number;
}
/**
 * Leather in model space: creases (`crease` frequencies per axis, sharpened by `sharpness`) and a grain (`grain`), mixed
 * `mix[0]` / `mix[1]`; the albedo darkens to `albedo[0]` + `albedo[1]` × (1 - height); the bump is `depth` view metres.
 */
export interface LeatherLook {
  readonly kind: 'leather'; readonly crease: SurfaceRgb; readonly sharpness: number; readonly grain: number;
  readonly mix: readonly [number, number]; readonly albedo: readonly [number, number]; readonly depth: number;
}
/**
 * Fieldstones below model height `below` (a smoothstep from `below[0]` to `below[1]`): `rows` rows per model unit, wavy by
 * `wave` (cycles round, amplitude), `perRow` stones a row (base + a per-row spread), mortar where a stone's edge is within
 * `mortar` (aspect `aspect`), each stone between `dark` and `light`, speckled `speckle` at `speckleScale`.
 */
export interface StoneBandLook {
  readonly kind: 'stoneBand'; readonly below: readonly [number, number]; readonly rows: number; readonly wave: readonly [number, number];
  readonly perRow: readonly [number, number]; readonly mortar: readonly [number, number]; readonly aspect: number;
  readonly dark: SurfaceRgb; readonly light: SurfaceRgb; readonly speckle: readonly [number, number]; readonly speckleScale: number; readonly mortarColour: SurfaceRgb;
}
/** The map's colour pulled `amount` of the way to its own luma (Rec. 709). */
export interface DesaturateLook { readonly kind: 'desaturate'; readonly amount: number }

/** One declared surface look. */
export type SurfaceLook = FirelightLook | ViewerLightLook | LeatherLook | StoneBandLook | DesaturateLook;
