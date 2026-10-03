import type { LevelSpec } from '#engine';

/** Measured rollout maxima; count targets rederive after calibration; provenance: budgets/ceiling-sources.json. */
export const BUDGET_CEILINGS = {
  "phone": {
    "current": {
      "gpuMB": 149.9466094970703
    },
    "spawn": {
      "gpuMB": 149.9466094970703
    },
    "whip": {
      "gpuMB": 149.9466094970703
    },
    "ray": {
      "gpuMB": 149.9466094970703
    },
    "quest": {
      "gpuMB": 149.9466094970703
    },
    "tower": {
      "gpuMB": 149.9466094970703
    }
  },
  "desktop": {
    "current": {
      "gpuMB": 181.8315734863282
    }
  }
} satisfies NonNullable<LevelSpec['budgets']['ceilings']>;
