// SHARD-PLATFORM M3 (look-family rows): Driftwood's toon light tunables' starting values (linear RGB) for the SDK toon light
// (@wildshard/sdk/looks/toonLight); the day / night clock turns them from look/backdrop.ts on.
export const TOON_TUNE = {
  uToonLift: [0.07, 0.035, 0.2], // added to the shade band (×albedo): the blue-violet of Rime's shadows
  uToonRim: [1.3, 0.95, 0.6], // rim colour × strength
  uToonTerm: [0.4, 0.16, 0.06], // terminator band colour × strength (×albedo²-ish saturated)
  uToonShadeGrade: 0, // 0..1 how much the shade band keeps of the sun's facet grade (0 = flat toon shade)
  uCloudShadow: 0.6, // cloud shadows (L4): strength 0..1
  uToonNight: 0, // 0 = day … 1 = night: the sea darkens its lagoon tint by it
  uSeaLevel: -1e4, // W4 caustics: the sea's still level (m; −1e4 = no sea) and their strength
  uCaustics: 0.5,
  uCloudTime: 0, // cloud shadows' scroll time (s), wind (m/s xz), feature size (m)
  uCloudWind: [3.2, 1.4],
  uCloudScale: 60,
  uFogZenith: [0.055, 0.2, 0.78], // L3 colour-ramp fog: the sky's zenith, the mid-distance aerial tint, the ramp (m)
  uFogNear: [0.5, 0.6, 0.98],
  uFogStart: 180,
  uFogEnd: 1700,
} as const;
