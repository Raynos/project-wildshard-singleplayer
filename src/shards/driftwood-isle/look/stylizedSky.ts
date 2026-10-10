/**
 * Driftwood's stylized sky (DRIFTWOOD-REMASTER L2, the user's pick D2: "stylized gradient sky + faceted cumulus replaces
 * the photoreal HDRI"). Moved from the engine (E357 S4.3); the look's backdrop (backdrop.ts) builds it in place of the HDRI.
 * SHARD-PLATFORM M3: the dome, the cumulus ring and their materials are the SDK faceted sky (@wildshard/sdk/looks/facetedSky);
 * Driftwood's programs are data (data/skyGlsl.ts), its midday palette too (data/skyPalette.ts).
 *
 *   const s = new StylizedSky(sunDir).build();   // s.dome follows the camera (Game.ts moves `sky.clouds`, which is the dome)
 *   s.envScene                                   // a copy of the dome at the origin for PMREMGenerator.fromScene (IBL specular)
 *   s.update(dt)                                 // cloud drift
 *   s.u.*                                        // colours DayNight blends (zenith, horizon, sun, cloud lit / shade, night)
 *
 * - **dome**: a saturated zenith → pale horizon gradient, a sun glow, a thin bright band on the horizon, stars at night.
 * - **cumulus**: faceted puffs drawn in a two-band sun ramp (white lit / lavender shade), a silver-lining fresnel on the
 *   rims when the sun is behind them, darker bellies, and a fade into the horizon colour at the bottom; drawn before the
 *   planet (Sky.ts renderOrder −12/−11), which therefore sits crisp IN FRONT of the clouds, as in the mockups.
 */
import * as THREE from 'three';
import { FacetedSky, type SkyPalette as PlatformSkyPalette } from '@wildshard/sdk/looks/facetedSky';
import { SKY_GLSL } from '../data/skyGlsl';
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
const CUMULUS_SEED = 0xc10d;

export class StylizedSky extends FacetedSky {
  constructor(sunDir: THREE.Vector3) { super(sunDir, SKY_GLSL, MIDDAY_SKY, CUMULUS_SEED); }
}
