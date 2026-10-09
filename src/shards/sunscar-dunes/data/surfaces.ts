import type { FirelightLook, SurfaceLook, ViewerLightLook } from '@wildshard/sdk/looks/surfaceLooks';

/**
 * Signal Dunes' surface looks as rows (SHARD-PLATFORM SF72, look-family rows) on the platform's surface families
 * (`@wildshard/sdk/looks/surfaceLooks`): the camp's firelight, the held leather's viewer light and grain, the brazier's
 * soot-dark iron on a fieldstone drum. `world/meshes.ts` chains them onto the loaded hero models, the whip's coil its own.
 */

/** The camp warmed by each burning fire within ~4.5 m (the fire effect's light slots): its own fire lights it. */
export const FIRELIGHT: FirelightLook = { kind: 'firelight', colour: [1, 0.45, 0.16], reach: 4.5, falloff: 2, gain: 1.8 };

/** The held leather's viewer-side light: faces turned to the eye lit, edges falling off, more as the dusk deepens, so the backlit fist and coil never read as a cut-out. */
const viewer = (gain: readonly [number, number, number], sheen: number): ViewerLightLook =>
  ({ kind: 'viewerLight', gain, facing: [0.2, 0.8], dusk: 0.7, sheen, sheenColour: [0.9, 0.62, 0.4], sheenPower: 3, sheenDamp: 0.6 });

/**
 * The glove (E399 / E407 row 4, round 16: lighter, glossier, more viewer light); round 19 (seat C after round 18: its
 * leather detail 2.1 against mockup D's 8.3): fine leather in the model's own space, creases ~5 mm and a grain ~1.5 mm
 * across a model ~2 units over a 0.14 m hand, the creases ~0.6 mm deep.
 */
export const GLOVE_SURFACE: readonly SurfaceLook[] = [
  viewer([0.58, 0.47, 0.38], 0.22),
  { kind: 'leather', crease: [9, 22, 9], sharpness: 6, grain: 46, mix: [0.55, 0.45], albedo: [0.8, 0.36], depth: 0.0006 },
];

/** The held coil's plaited leather: the glove's viewer light, a little dimmer, each strand's edge catching the sheen. */
export const COIL_SURFACE: readonly SurfaceLook[] = [viewer([0.42, 0.37, 0.33], 0.16)];

/**
 * The brazier (round 8, the council since round 4: a copper bowl and twisted copper post on a clean tan plinth; mockup
 * C: soot-dark iron and weathered stone, warm only where the fire lights it): its texture pulled to grey; round 11: the
 * plinth below the post (model y < -0.55) rows of irregular grey-brown fieldstones with dark mortar (the greying after
 * it keeps it grey); the fire lights it.
 */
export const BRAZIER_SURFACE: readonly SurfaceLook[] = [
  { kind: 'desaturate', amount: 0.8 },
  { kind: 'stoneBand', below: [-0.6, -0.52], rows: 11, wave: [5, 0.25], perRow: [9, 4], mortar: [0.04, 0.12], aspect: 1.6,
    dark: [0.07, 0.06, 0.05], light: [0.17, 0.14, 0.115], speckle: [0.8, 0.4], speckleScale: 5, mortarColour: [0.05, 0.04, 0.035] },
  FIRELIGHT,
];

/** The camp's lantern and cookfire light the wagon, the crates and the sacks. */
export const CAMP_SURFACE: readonly SurfaceLook[] = [FIRELIGHT];
