import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 109.74499130249023
    },
    "spawn": {
      "gpuMB": 109.74499130249023
    },
    "whip": {
      "gpuMB": 109.74499130249023
    },
    "ray": {
      "gpuMB": 109.74499130249023
    },
    "quest": {
      "gpuMB": 109.74499130249023
    },
    "tower": {
      "gpuMB": 109.74499130249023
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;
