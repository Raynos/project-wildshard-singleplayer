/**
 * Driftwood's stylized sky (DRIFTWOOD-REMASTER L2, the user's pick D2: "stylized gradient sky + faceted cumulus replaces
 * the photoreal HDRI"). Moved from the engine (E357 S4.3); the look's backdrop (backdrop.ts) builds it in place of the HDRI.
 * SHARD-PLATFORM M3: the dome, the cumulus ring and their materials are the SDK faceted sky (@wildshard/sdk/looks/facetedSky);
 * Driftwood's programs are material graphs (data/skyLook.ts), its midday palette data (data/skyPalette.ts).
 *
 *   the backdrop (backdrop.ts) builds the FacetedSky from SKY_GRAPHS, MIDDAY_SKY and CUMULUS_SEED:
 *   const s = new FacetedSky(sunDir, graphs, MIDDAY_SKY, CUMULUS_SEED).build(compiler);  // s.dome follows the camera (Game.ts moves `sky.clouds`, which is the dome)
 *   s.envScene                                   // a copy of the dome at the origin for PMREMGenerator.fromScene (IBL specular)
 *   s.u.*                                        // colours DayNight blends (zenith, horizon, sun, cloud lit / shade, night), via setPalette
 *
 * - **dome**: a saturated zenith → pale horizon gradient, a sun glow, a thin bright band on the horizon, stars at night.
 * - **cumulus**: faceted puffs drawn in a two-band sun ramp (white lit / lavender shade), a silver-lining fresnel on the
 *   rims when the sun is behind them, darker bellies, and a fade into the horizon colour at the bottom; drawn before the
 *   planet (Sky.ts renderOrder −12/−11), which therefore sits crisp IN FRONT of the clouds, as in the mockups.
 */
import * as THREE from 'three';
import type { SkyPalette as PlatformSkyPalette } from '../runtime/looks/facetedSky';
import { MIDDAY_SKY_ROWS } from '../data/skyPalette';

/** the sky's day palette (linear, pre-tonemap); DayNight lerps these per preset */
export type SkyPalette = PlatformSkyPalette;

const rgb = (c: readonly [number, number, number]): THREE.Color => new THREE.Color(...c);
export const MIDDAY_SKY: SkyPalette = {
  zenith: rgb(MIDDAY_SKY_ROWS.zenith),
  horizon: rgb(MIDDAY_SKY_ROWS.horizon),
  below: rgb(MIDDAY_SKY_ROWS.below),
  sunGlow: rgb(MIDDAY_SKY_ROWS.sunGlow),
  cloudLit: rgb(MIDDAY_SKY_ROWS.cloudLit),
  cloudShade: rgb(MIDDAY_SKY_ROWS.cloudShade),
  night: MIDDAY_SKY_ROWS.night,
};

/** the cumulus ring's seed */
export const CUMULUS_SEED = 0xc10d;
