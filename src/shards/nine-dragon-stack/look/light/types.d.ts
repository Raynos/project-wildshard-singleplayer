export interface LightSettings {
  /** the light volume on / off, its diffuse gain on the wash, the wet stone's glossy sheen of it */
  pools: number;
  poolGain: number;
  sheen: number;
  /** the window glow in the fog (bloom alpha) on / off, its halo / veil gains, threshold and distance ramp (m) */
  glow: number;
  halo: number;
  veil: number;
  glowThr: number;
  glowNear: number;
  glowFar: number;
  /** the learned LUT's strength (0 = off) */
  grade: number;
  /** the wet film's sky reflection on top of the fresnel term (0 = off) */
  wetSky: number;
  /** the blue-hour ambient on every non-emissive wash (1 = none) */
  ambient: number;
}

