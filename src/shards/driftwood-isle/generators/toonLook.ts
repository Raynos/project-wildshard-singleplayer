// SHARD-PLATFORM M3 (look-family rows): Driftwood's day light and colour-ramp fog starting values (linear RGB); the day /
// night clock (look/backdrop.ts) turns the day light and the ramp's colours from then on.

/** L3 colour-ramp fog (the engine's ColourRampFog): the ramp (m), the mid-distance aerial tint, the sky's zenith */
export const RAMP_FOG = { start: 180, end: 1700, near: [0.5, 0.6, 0.98], zenith: [0.055, 0.2, 0.78] } as const;
