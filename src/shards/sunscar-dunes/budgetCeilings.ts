import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 108.99499130249023
    },
    "spawn": {
      "gpuMB": 108.99499130249023
    },
    "whip": {
      "gpuMB": 108.99499130249023
    },
    "ray": {
      "gpuMB": 108.99499130249023
    },
    "quest": {
      "gpuMB": 108.99499130249023
    },
    "tower": {
      "gpuMB": 108.99499130249023
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;
