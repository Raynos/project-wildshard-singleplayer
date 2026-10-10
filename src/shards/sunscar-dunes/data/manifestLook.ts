/** A linear colour triple (the manifest's RGB). */
const rgb = (r: number, g: number, b: number): [number, number, number] => [r, g, b];
/** One ring's eight azimuth bumps: their compass centres, one spread and roughness, and each one's height. */
const bands = (azimuths: readonly number[], spread: number, heights: readonly number[], fallback: number, rough: number): { azimuth: number; spread: number; height: number; rough: number }[] =>
  azimuths.map((azimuth, i) => ({ azimuth, spread, height: heights[i] ?? fallback, rough }));

/**
 * "Last Light" (style bible) as the manifest's sky rows (SHARD-PLATFORM M3: pure data, read by manifest.ts): the key 10°
 * up, behind-left of the spawn view (look/render.ts KEY); a cool sky fill so every shaded face reads blue-violet, never
 * black (review R1).
 */
export const SIGNAL_SKY = { sunColor: rgb(1, 0.74, 0.52), sunIntensity: 2.6, envIntensity: 0.4, bgIntensity: 1, fogSunColor: rgb(0.78, 0.38, 0.22), cloudSunColor: rgb(0.9, 0.5, 0.4),
  hemiSky: 0x6e5248, hemiGround: 0x7a4426, hemiIntensity: 0.8, sun: { azimuth: 52, elevation: 11 } };
/**
 * Loop 4: real aerial perspective (the engine's fog is exponential in distance; `FOG` near / far are unused): the dune
 * rows and the far buttes lay back into the violet in layers (review R9), warm toward the sun. `weather`: the Matriarch's
 * sand storm (E390).
 */
export const SIGNAL_ATMOSPHERE = { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0.00045, volumetricSunColor: rgb(1, 0.55, 0.35), weather: true };
/**
 * A light split-tone (R9): warm highlights, blue-violet shadows. The greyer zenith (data/sky.ts) no longer clips. E399
 * (council round 2, R2B-1: measured patches): no crushed darks, a muted lavender floor.
 */
export const SIGNAL_GRADE = { saturation: 0.12, brightness: 0, contrast: 0.12, bloomIntensity: 0.15, bloomThreshold: 0.9, shadowTint: rgb(0.94, 0.97, 1.08), highTint: rgb(1.05, 1, 0.94), lift: rgb(0.004, 0.002, 0.004), gain: rgb(1, 1, 1), gamma: 1 };
/**
 * The horizon's rings, near to far. Round 2 (R1B-14 / R1C-5): the inner ring at 340 m stood on the dune skirt as an
 * enclosing mauve wall; the skirt's dunes run out to the far ranges instead. E399 (the mockups): low hazy dune ranges at
 * the horizon, warm and soft, no mountains. E399 (council round 1, D2: mockups A and D show layered blue-grey ranges past
 * the dunes): farther, taller rings, cool and hazed, their crests between the near ring's. Round 8 (the council: one crisp
 * lavender cut-out; mockups A and dusk-fire: several dim grey-violet layers fading back): three rings, the nearer darker
 * and warmer, the farther paler, all lower than before; round 9 (seat B: in D a bright haze band under the horizon, 131
 * against the mockup's dark 12-20): less haze, they dissolve into the afterglow less.
 */
export const SIGNAL_HORIZON = { cloudSea: false, rings: [
  { r: 470, base: 0, color: rgb(0.2, 0.09, 0.06), top: rgb(0.36, 0.17, 0.1), snowLine: 2, haze: 0.35, floor: -10,
    bands: bands([0, 45, 90, 135, 180, 225, 270, 315], 50, [9, 13, 7, 11, 10, 14, 8, 12], 10, 0.15) },
  { r: 520, base: 0, color: rgb(0.06, 0.045, 0.06), top: rgb(0.13, 0.09, 0.11), snowLine: 2, haze: 0.1, floor: -10,
    bands: bands([10, 55, 95, 140, 190, 235, 280, 325], 44, [15, 19, 13, 21, 16, 20, 14, 18], 16, 0.22) },
  { r: 560, base: 0, color: rgb(0.08, 0.065, 0.1), top: rgb(0.16, 0.13, 0.17), snowLine: 2, haze: 0.16, floor: -10,
    bands: bands([30, 70, 115, 160, 210, 255, 300, 345], 46, [22, 26, 19, 28, 23, 27, 20, 25], 23, 0.2) },
  { r: 600, base: 0, color: rgb(0.11, 0.09, 0.13), top: rgb(0.21, 0.17, 0.21), snowLine: 2, haze: 0.25, floor: -10,
    bands: bands([0, 40, 85, 125, 175, 220, 265, 310], 50, [29, 33, 26, 35, 30, 34, 27, 32], 30, 0.18) },
] };
