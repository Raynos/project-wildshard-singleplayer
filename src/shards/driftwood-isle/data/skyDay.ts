import { MIDDAY_SKY_ROWS } from './skyPalette';

// SHARD-PLATFORM M3 (look-family rows): Driftwood's day / night clock as a faceted-day row for the SDK
// (@wildshard/sdk/looks/facetedDay). DRIFTWOOD-REMASTER L7, the user's pick D3: "a real clock — 20 min day + 4 min night,
// night moonlit blue and playable"; E147: "48 is good" — both doubled, a 40 min day + 8 min night. Colours: a number is an
// sRGB hex, a triple linear RGB (pre-tonemap). The sun rises in the east, stands 62° up in the south at noon and sets in
// the west; the moon rides a high arc (≥ 25°). The shadow light turns in 0.25° steps (E89: a shadow map that turns a hair
// each frame crawls; each step crossfades in over ~2 s, Sky's ShadowFade). The PMREM environment is re-rendered every 15 s.
const DAY = 20 / 24;

const MIDDAY = {
  sky: MIDDAY_SKY_ROWS,
  sunColor: [1.0, 0.97, 0.9], sunI: 2.7,
  hemiSky: 0x7b90f4, hemiGround: 0xe8b890, hemiI: 1.15,
  lift: [0.08, 0.05, 0.13], rim: [1.3, 0.95, 0.6], fogNear: [0.5, 0.6, 0.98], fogSun: [1.0, 0.98, 0.92],
  disc: [1.0, 0.95, 0.85], cloudShadow: 0.32, dusk: 0,
} as const;
const GOLDEN = {
  sky: { zenith: [0.06, 0.16, 0.6], horizon: [1.0, 0.7, 0.45], below: [0.35, 0.4, 0.55], sunGlow: [1.0, 0.55, 0.22], cloudLit: [1.45, 1.0, 0.7], cloudShade: [0.52, 0.44, 0.78], night: 0 },
  sunColor: [1.0, 0.72, 0.45], sunI: 2.5,
  hemiSky: 0x7a7ce0, hemiGround: 0xe0a070, hemiI: 0.85,
  lift: [0.1, 0.03, 0.2], rim: [1.6, 0.9, 0.45], fogNear: [0.75, 0.6, 0.8], fogSun: [1.0, 0.7, 0.42],
  disc: [1.0, 0.75, 0.5], cloudShadow: 0.28, dusk: 0.7,
} as const;
const SUNSET = {
  sky: { zenith: [0.05, 0.08, 0.32], horizon: [1.0, 0.45, 0.3], below: [0.25, 0.22, 0.4], sunGlow: [1.0, 0.4, 0.15], cloudLit: [1.3, 0.62, 0.45], cloudShade: [0.4, 0.3, 0.6], night: 0.1 },
  sunColor: [1.0, 0.5, 0.3], sunI: 1.8,
  hemiSky: 0x5a5ab8, hemiGround: 0xb07060, hemiI: 0.75,
  lift: [0.1, 0.03, 0.18], rim: [1.6, 0.7, 0.35], fogNear: [0.7, 0.45, 0.6], fogSun: [1.0, 0.5, 0.3],
  disc: [1.0, 0.55, 0.35], cloudShadow: 0.2, dusk: 0.9,
} as const;
const NIGHT = {
  sky: { zenith: [0.006, 0.014, 0.06], horizon: [0.05, 0.1, 0.26], below: [0.02, 0.05, 0.13], sunGlow: [0.25, 0.32, 0.5], cloudLit: [0.24, 0.3, 0.48], cloudShade: [0.07, 0.09, 0.2], night: 1 },
  sunColor: [0.55, 0.7, 1.0], sunI: 1.25, // moonlight: blue, bright enough to play by
  hemiSky: 0x3048a0, hemiGround: 0x243050, hemiI: 0.7,
  lift: [0.02, 0.035, 0.1], rim: [0.6, 0.8, 1.2], fogNear: [0.08, 0.13, 0.3], fogSun: [0.4, 0.5, 0.8],
  disc: [0.85, 0.9, 1.0], cloudShadow: 0.25, dusk: 1,
} as const;
const DAWN = {
  sky: { zenith: [0.07, 0.14, 0.45], horizon: [1.0, 0.62, 0.5], below: [0.3, 0.32, 0.5], sunGlow: [1.0, 0.6, 0.35], cloudLit: [1.3, 0.9, 0.8], cloudShade: [0.45, 0.42, 0.72], night: 0.05 },
  sunColor: [1.0, 0.68, 0.5], sunI: 1.9,
  hemiSky: 0x6a78d0, hemiGround: 0xc09080, hemiI: 0.8,
  lift: [0.09, 0.04, 0.2], rim: [1.4, 0.85, 0.6], fogNear: [0.7, 0.6, 0.85], fogSun: [1.0, 0.68, 0.5],
  disc: [1.0, 0.7, 0.55], cloudShadow: 0.35, dusk: 0.6,
} as const;

export const DRIFTWOOD_SKY_DAY = {
  dayFraction: DAY,
  start: 0.2 * DAY, // mid-morning, the sun 36° up in the ESE
  schedule: [{ phase: 'day', from: 6, to: 18, minutes: 40 }, { phase: 'night', from: 18, to: 30, minutes: 8 }],
  // Settings ▸ Time of day's fixed picks: noon, the GOLDEN / SUNSET keys, mid-night
  fixed: { midday: DAY / 2, golden: 0.74, sunset: DAY - 0.02, night: 0.92 },
  namedPhases: { dawn: 0.03, noon: 0.42, dusk: 0.8, night: 0.92 },
  presets: { dawn: DAWN, midday: MIDDAY, golden: GOLDEN, sunset: SUNSET, night: NIGHT },
  frames: [
    [0.0, 'dawn'], [0.07, 'midday'], [0.62, 'midday'], [0.74, 'golden'], [DAY - 0.02, 'sunset'],
    [DAY + 0.03, 'night'], [0.975, 'night'], [1.0, 'dawn'],
  ],
  sun: { rise: 90, sweep: 180, noon: 62, nightRise: 270, nightSweep: 180, nadir: 40 },
  moon: { rise: 100, sweep: 160, base: 28, arc: 30 },
  night: { eve: [DAY - 0.03, DAY], eveHeight: 0.25, rise: [DAY - 0.004, DAY + 0.03], fall: [0.975, 1] },
  fade: { sunY: [0.0, 0.08], moonIn: [DAY + 0.006, DAY + 0.03], moonOut: [0.985, 0.999] },
  shadowStepDeg: 0.25,
  envRefresh: 15,
  envSize: 64, // a 336 × 256 half-float cube-UV atlas
  startSun: [-0.74, 0.616, -0.27], // mid-morning from the east-south-east, 38° up
  planetHaze: [0.55, 0.7, 0.95], planetHazeDay: 0.4,
  moonDisc: 0.7,
  sunIBase: 2.7,
} as const;
