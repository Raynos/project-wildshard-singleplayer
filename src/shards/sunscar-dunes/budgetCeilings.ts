import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 109.88733863830566
    },
    "spawn": {
      "gpuMB": 109.88733863830566
    },
    "whip": {
      "gpuMB": 109.88733863830566
    },
    "ray": {
      "gpuMB": 109.88733863830566
    },
    "quest": {
      "gpuMB": 109.88733863830566
    },
    "tower": {
      "gpuMB": 109.88733863830566
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;
