// SHARD-PLATFORM M3 (look-family rows): Driftwood's midday sky palette (linear RGB, pre-tonemap) for the SDK faceted sky.
export const MIDDAY_SKY_ROWS = {
  zenith: [0.055, 0.2, 0.78],
  horizon: [0.36, 0.7, 1.0],
  below: [0.22, 0.46, 0.72],
  sunGlow: [1.0, 0.88, 0.62],
  cloudLit: [1.25, 1.22, 1.16],
  cloudShade: [0.52, 0.6, 0.92],
  night: 0,
} as const;
