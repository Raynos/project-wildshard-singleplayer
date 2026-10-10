// Nine Dragon's ambient occlusion (SHARD-PLATFORM M3, ex look/render.ts; @wildshard/sdk/looks/aoTuning): AO at the city's
// scale — 2.2 m reaches the eave's underside, the awning's shadow on the wall, the step's riser and the feet; an ink-blue
// occlusion (never black: the wash stays a wash); half res with a depth-aware upsample. It runs before the ink silhouette
// (the composite), so the lines stay crisp over it. The AO fades out with the scene's THREE.Fog distances: post AO darkens
// whatever colour the pixel ends up, the silk fog included, and past ~25 m the fog is most of a far wall's colour, so the
// AO fades by 80 m (the Well's deep strata were speckled with it).

/** the look's AO row: counts are [phone, other] */
export const AO_TUNING = {
  radius: 2.2, falloff: 1, intensity: 5, samples: [6, 16], denoiseSamples: [4, 8], denoiseIterations: [1, 2], denoiseRadius: 8,
  color: [0.07, 0.08, 0.13], halfRes: true, fog: [25, 80],
} as const;
