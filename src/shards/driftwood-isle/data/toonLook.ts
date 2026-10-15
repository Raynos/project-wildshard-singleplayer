// SHARD-PLATFORM M3 (look-family rows): Driftwood's toon light and colour-ramp fog starting values (linear RGB); the day /
// night clock (look/backdrop.ts) turns the day light and the ramp's colours from then on.
/** the day light every toon look follows (look/toon.ts `dayLight`) */
export const DAY_LIGHT = {
  uToonLift: [0.07, 0.035, 0.2], // added to the shade band (×albedo): the blue-violet of Rime's shadows
  uToonRim: [1.3, 0.95, 0.6], // rim colour × strength
  uCloudShadow: 0.6, // cloud shadows (L4): strength 0..1
  uToonNight: 0, // 0 = day … 1 = night: the sea darkens its lagoon tint by it
  uSeaLevel: -1e4, // W4 caustics: the sea's still level (m; −1e4 = no sea)
  uCloudTime: 0, // cloud shadows' scroll time (s)
} as const;

/** the classic light model's other tunables (runtime/looks/toonLight.ts) */
export const TOON_TUNE = {
  uToonTerm: [0.4, 0.16, 0.06], // terminator band colour × strength (×albedo²-ish saturated)
  uToonShadeGrade: 0, // 0..1 how much the shade band keeps of the sun's facet grade (0 = flat toon shade)
  uCaustics: 0.5, // W4 caustics' strength
  uCloudWind: [3.2, 1.4], // cloud shadows' wind (m/s xz) and feature size (m)
  uCloudScale: 60,
} as const;

/** L3 colour-ramp fog (the engine's ColourRampFog): the ramp (m), the mid-distance aerial tint, the sky's zenith */
export const RAMP_FOG = { start: 180, end: 1700, near: [0.5, 0.6, 0.98], zenith: [0.055, 0.2, 0.78] } as const;
